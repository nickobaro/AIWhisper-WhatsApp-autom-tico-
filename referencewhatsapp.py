#!/usr/bin/env python3
import requests
import json
import time
import sqlite3
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import configparser
import logging
import sys
import os
import threading
import re
from urllib3.exceptions import InsecureRequestWarning

# Disable SSL warnings
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

class PRTGAlertingSystem:
    def __init__(self, config_file='config.ini'):
        self.config = configparser.ConfigParser()
        self.config.read(config_file)
        
        # PRTG Configuration
        self.prtg_url = self.config.get('PRTG', 'url')
        self.username = self.config.get('PRTG', 'username')
        self.password = self.config.get('PRTG', 'password')
        
        # WhatsApp Configuration
        self.whatsapp_api_url = self.config.get('WhatsApp', 'api_url')
        self.whatsapp_recipients = self.config.get('WhatsApp', 'recipients').split(',')
        
        # Email Configuration
        self.smtp_server = self.config.get('Email', 'smtp_server')
        self.smtp_port = self.config.getint('Email', 'smtp_port')
        self.sender_email = self.config.get('Email', 'sender_email')
        self.sender_password = self.config.get('Email', 'sender_password')
        self.email_recipients = self.config.get('Email', 'recipients').split(',')
        
        # Monitoring Configuration
        self.check_interval = self.config.getint('Monitoring', 'check_interval')
        self.database_file = self.config.get('Monitoring', 'database_file')
        self.log_file = self.config.get('Monitoring', 'log_file')
        
        # Setup logging
        self.setup_logging()
        
        # Initialize database
        self.init_database()
        
        self.logger.info("PRTG Alerting System initialized - UP/DOWN monitoring only")
    
    def setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.log_file),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def init_database(self):
        """Initialize SQLite database to track sensor states"""
        self.conn = sqlite3.connect(self.database_file, check_same_thread=False)
        cursor = self.conn.cursor()
        
        # Create simplified table for UP/DOWN tracking only
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sensor_history (
                sensor_id TEXT PRIMARY KEY,
                sensor_name TEXT,
                device_name TEXT,
                current_status INTEGER,
                previous_status INTEGER,
                last_change TIMESTAMP,
                down_time TIMESTAMP,
                up_time TIMESTAMP,
                total_downtime_minutes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Check if we need to migrate existing data
        cursor.execute("PRAGMA table_info(sensor_history)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'first_seen' in columns:
            self.logger.info("Migrating database schema - removing first_seen column")
            self.migrate_database()
        
        self.conn.commit()
        self.logger.info("Database initialized for UP/DOWN monitoring")
    
    def migrate_database(self):
        """Migrate database to remove first_seen column"""
        cursor = self.conn.cursor()
        
        try:
            # Backup existing data
            cursor.execute("SELECT sensor_id, sensor_name, device_name, current_status, previous_status, last_change, down_time, up_time, total_downtime_minutes FROM sensor_history")
            backup_data = cursor.fetchall()
            
            # Drop old table
            cursor.execute("DROP TABLE sensor_history")
            
            # Create new table
            cursor.execute('''
                CREATE TABLE sensor_history (
                    sensor_id TEXT PRIMARY KEY,
                    sensor_name TEXT,
                    device_name TEXT,
                    current_status INTEGER,
                    previous_status INTEGER,
                    last_change TIMESTAMP,
                    down_time TIMESTAMP,
                    up_time TIMESTAMP,
                    total_downtime_minutes INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Restore data
            if backup_data:
                cursor.executemany('''
                    INSERT INTO sensor_history 
                    (sensor_id, sensor_name, device_name, current_status, previous_status, 
                     last_change, down_time, up_time, total_downtime_minutes)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', backup_data)
                
            self.logger.info(f"Database migration completed. Restored {len(backup_data)} records.")
            
        except Exception as e:
            self.logger.error(f"Database migration failed: {e}")
            self.conn.rollback()
            raise
    
    def fetch_sensors(self):
        """Fetch current sensor data from PRTG"""
        try:
            url = f"{self.prtg_url}/api/table.json"
            params = {
                'content': 'sensors',
                'columns': 'objid,name,device,status,status_raw',
                'count': '*',
                'username': self.username,
                'password': self.password
            }
            
            self.logger.debug(f"Fetching sensors from {url}")
            response = requests.get(url, params=params, verify=False, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            sensors = data.get('sensors', [])
            self.logger.info(f"Fetched {len(sensors)} sensors from PRTG")
            return sensors
            
        except Exception as e:
            self.logger.error(f"Error fetching sensors: {e}")
            return []
    
    def check_status_changes(self, current_sensors):
        """Check for UP/DOWN status changes only and trigger alerts"""
        cursor = self.conn.cursor()
        current_time = datetime.now()
        
        for sensor in current_sensors:
            sensor_id = sensor.get('objid', '')
            sensor_name = sensor.get('name', '')
            device_name = sensor.get('device', '')
            current_status = int(sensor.get('status_raw', 3))
            
            # Skip paused sensors
            if current_status == 7:
                continue
            
            # Get previous status from database
            cursor.execute(
                'SELECT current_status, down_time FROM sensor_history WHERE sensor_id = ?',
                (sensor_id,)
            )
            result = cursor.fetchone()
            
            if result:
                stored_current_status, down_time_str = result
                down_time = datetime.fromisoformat(down_time_str) if down_time_str else None
                is_new_sensor = False
                
                # Use stored current status as previous for comparison
                previous_status = stored_current_status
            else:
                # New sensor - initialize
                previous_status = current_status
                down_time = None
                is_new_sensor = True
                
                # Insert new sensor
                cursor.execute('''
                    INSERT INTO sensor_history 
                    (sensor_id, sensor_name, device_name, current_status, previous_status, last_change)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (sensor_id, sensor_name, device_name, current_status, current_status, 
                      current_time.isoformat()))
                self.conn.commit()
                self.logger.info(f"New sensor added: {sensor_name} on {device_name}")
                continue
            
            # Check for UP/DOWN status changes ONLY (only for existing sensors)
            if previous_status != current_status and not is_new_sensor:
                # Only alert for UP (3) to DOWN (5) or DOWN (5) to UP (3) transitions
                if (previous_status == 3 and current_status == 5) or (previous_status == 5 and current_status == 3):
                    self.handle_status_change(
                        sensor_id, sensor_name, device_name,
                        previous_status, current_status, current_time, down_time
                    )
            
            # Update database with current status
            cursor.execute('''
                UPDATE sensor_history 
                SET sensor_name = ?, device_name = ?, current_status = ?, 
                    previous_status = ?, last_change = ?
                WHERE sensor_id = ?
            ''', (sensor_name, device_name, current_status, previous_status, 
                  current_time.isoformat(), sensor_id))
        
        self.conn.commit()
    
    def handle_status_change(self, sensor_id, sensor_name, device_name, 
                           prev_status, curr_status, current_time, down_time):
        """Handle UP/DOWN status changes and send alerts with downtime information"""
        
        cursor = self.conn.cursor()
        
        # Sensor going DOWN (from UP to DOWN)
        if prev_status == 3 and curr_status == 5:
            message = f"🚨 PRTG ALERT - SENSOR DOWN\n\n"
            message += f"📡 Sensor: {sensor_name}\n"
            message += f"🖥️ Device: {device_name}\n"
            message += f"📊 Status Change: UP → DOWN\n"
            message += f"⏰ Down Time: {current_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            message += f"🔴 Severity: CRITICAL\n"
            message += f"🆔 Sensor ID: {sensor_id}\n"
            message += f"🌐 PRTG URL: {self.prtg_url}"
            
            self.send_alerts(message, "CRITICAL", sensor_name, device_name)
            
            # Store the exact down time
            cursor.execute(
                'UPDATE sensor_history SET down_time = ? WHERE sensor_id = ?',
                (current_time.isoformat(), sensor_id)
            )
            self.conn.commit()
            
            self.logger.warning(f"Sensor DOWN: {sensor_name} on {device_name} at {current_time}")
        
        # Sensor RECOVERING (from DOWN to UP)
        elif prev_status == 5 and curr_status == 3:
            # Calculate downtime
            recovery_minutes = 0
            downtime_text = "Unknown"
            down_time_display = ""
            
            if down_time:
                try:
                    recovery_duration = current_time - down_time
                    recovery_minutes = int(recovery_duration.total_seconds() / 60)
                    recovery_seconds = int(recovery_duration.total_seconds())
                    
                    # Format downtime in multiple formats
                    if recovery_seconds < 60:
                        downtime_text = f"{recovery_seconds} seconds"
                    elif recovery_minutes < 60:
                        downtime_text = f"{recovery_minutes} minutes"
                    else:
                        hours = recovery_minutes // 60
                        minutes = recovery_minutes % 60
                        if minutes == 0:
                            downtime_text = f"{hours} hour{'s' if hours > 1 else ''}"
                        else:
                            downtime_text = f"{hours}h {minutes}m"
                    
                    down_time_display = f"📅 Down Since: {down_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
                    down_time_display += f"🕐 Down Duration: {downtime_text}\n"
                    
                except Exception as e:
                    self.logger.error(f"Error calculating downtime: {e}")
                    downtime_text = "Calculation Error"
            else:
                downtime_text = "Not tracked"
            
            message = f"✅ PRTG RECOVERY - SENSOR UP\n\n"
            message += f"📡 Sensor: {sensor_name}\n"
            message += f"🖥️ Device: {device_name}\n"
            message += f"📊 Status Change: DOWN → UP\n"
            message += down_time_display
            message += f"⏰ Recovery Time: {current_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
            message += f"⏱️ Total Downtime: {downtime_text}\n"
            message += f"🟢 Status: RECOVERED\n"
            message += f"🆔 Sensor ID: {sensor_id}\n"
            message += f"🌐 PRTG URL: {self.prtg_url}"
            
            # Add performance impact assessment
            if recovery_minutes > 0:
                if recovery_minutes < 5:
                    message += f"\n📈 Impact: MINIMAL (< 5 minutes)"
                elif recovery_minutes < 30:
                    message += f"\n📈 Impact: MODERATE ({recovery_minutes} minutes)"
                else:
                    message += f"\n📈 Impact: SIGNIFICANT ({downtime_text})"
            
            self.send_alerts(message, "RECOVERY", sensor_name, device_name)
            
            # Update database - clear down_time and store recovery info
            cursor.execute(
                'UPDATE sensor_history SET down_time = NULL, up_time = ?, total_downtime_minutes = ? WHERE sensor_id = ?',
                (current_time.isoformat(), recovery_minutes, sensor_id)
            )
            self.conn.commit()
            
            self.logger.info(f"Sensor RECOVERED: {sensor_name} on {device_name} (Downtime: {downtime_text})")
    
    def send_alerts(self, message, alert_type, sensor_name, device_name):
        """Send alerts via WhatsApp and Email"""
        # Send WhatsApp alerts
        for recipient in self.whatsapp_recipients:
            if recipient.strip():
                threading.Thread(target=self.send_whatsapp_alert, args=(message, recipient.strip())).start()
        
        # Send email alerts
        subject = f"PRTG {alert_type}: {sensor_name} on {device_name}"
        threading.Thread(target=self.send_email_alert, args=(subject, message)).start()
    
    def send_whatsapp_alert(self, message, recipient):
        """Send WhatsApp message using Baileys API"""
        try:
            # First check if WhatsApp is connected
            try:
                status_response = requests.get(f"{self.whatsapp_api_url}/status", timeout=5)
                if status_response.status_code == 200:
                    status_data = status_response.json()
                    if not status_data.get('connected'):
                        self.logger.error(f"❌ WhatsApp not connected. Please scan QR code.")
                        return
                else:
                    self.logger.error(f"❌ WhatsApp API not responding: {status_response.status_code}")
                    return
            except Exception as e:
                self.logger.error(f"❌ Cannot check WhatsApp status: {e}")
                return
            
            # Clean and format number properly
            clean_number = re.sub(r'[^\d]', '', recipient)
            
            # Ensure it has country code (91 for India)
            if not clean_number.startswith('91'):
                clean_number = '91' + clean_number
                
            payload = {
                "number": clean_number,
                "message": message
            }
            
            self.logger.debug(f"Sending WhatsApp to {clean_number}")
            
            response = requests.post(
                f"{self.whatsapp_api_url}/send",
                headers={'Content-Type': 'application/json'},
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                response_data = response.json()
                if response_data.get('success'):
                    self.logger.info(f"✅ WhatsApp alert sent to {recipient}")
                else:
                    self.logger.error(f"❌ WhatsApp API returned error: {response_data}")
            else:
                self.logger.error(f"❌ WhatsApp alert failed for {recipient}: {response.status_code} - {response.text}")
                
        except Exception as e:
            self.logger.error(f"❌ Error sending WhatsApp alert to {recipient}: {e}")
    
    def send_email_alert(self, subject, message):
        """Send email alert"""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.sender_email
            msg['To'] = ", ".join(self.email_recipients)
            msg['Subject'] = subject
            
            # Create HTML version of the message for better formatting
            html_message = message.replace('\n', '<br>')
            html_message = f"<html><body><pre style='font-family: monospace;'>{html_message}</pre></body></html>"
            
            msg.attach(MIMEText(html_message, 'html'))
            
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.sender_email, self.sender_password)
            server.sendmail(self.sender_email, self.email_recipients, msg.as_string())
            server.quit()
            
            self.logger.info("✅ Email alert sent successfully")
            
        except Exception as e:
            self.logger.error(f"❌ Error sending email: {e}")
    
    def test_whatsapp_connection(self):
        """Test WhatsApp API connection"""
        try:
            response = requests.get(f"{self.whatsapp_api_url}/status", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get('connected'):
                    self.logger.info("✅ WhatsApp API is connected and ready")
                    return True
                else:
                    self.logger.warning("⚠️ WhatsApp API is running but not connected. Please scan QR code.")
                    return False
            else:
                self.logger.error(f"❌ WhatsApp API not responding: {response.status_code}")
                return False
        except Exception as e:
            self.logger.error(f"❌ Cannot connect to WhatsApp API: {e}")
            return False
    
    def test_send_whatsapp(self, test_message="🧪 PRTG Test Message - UP/DOWN Monitoring"):
        """Send a test WhatsApp message"""
        test_message_full = f"{test_message}\n\n⏰ Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n🔧 System Status: Operational\n📊 Monitoring: UP/DOWN transitions only"
        self.logger.info("Sending test WhatsApp message...")
        for recipient in self.whatsapp_recipients:
            if recipient.strip():
                self.send_whatsapp_alert(test_message_full, recipient.strip())
    
    def generate_status_report(self):
        """Generate current status report - DOWN sensors only"""
        cursor = self.conn.cursor()
        current_time = datetime.now()
        
        # Get DOWN sensors only (status = 5)
        cursor.execute('''
            SELECT sensor_name, device_name, current_status, last_change, down_time, total_downtime_minutes
            FROM sensor_history 
            WHERE current_status = 5
            ORDER BY last_change DESC
        ''')
        
        down_sensors = cursor.fetchall()
        
        # Get total sensor count
        cursor.execute('SELECT COUNT(*) FROM sensor_history')
        total_sensors = cursor.fetchone()[0]
        
        # Get UP sensors count
        cursor.execute('SELECT COUNT(*) FROM sensor_history WHERE current_status = 3')
        up_sensors = cursor.fetchone()[0]
        
        report = f"📊 PRTG STATUS REPORT - UP/DOWN MONITORING\n"
        report += f"📅 Generated: {current_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        report += f"📈 Total Sensors: {total_sensors}\n"
        report += f"🟢 UP Sensors: {up_sensors}\n"
        report += f"🔴 DOWN Sensors: {len(down_sensors)}\n\n"
        
        if down_sensors:
            report += "🔴 DOWN SENSORS:\n"
            report += "=" * 40 + "\n"
            
            for sensor_name, device_name, status, last_change, down_time, total_downtime in down_sensors:
                downtime_info = ""
                if down_time:
                    try:
                        down_time_dt = datetime.fromisoformat(down_time)
                        current_downtime = current_time - down_time_dt
                        minutes = int(current_downtime.total_seconds() / 60)
                        if minutes < 60:
                            downtime_info = f" (DOWN for {minutes}m)"
                        else:
                            hours = minutes // 60
                            mins = minutes % 60
                            downtime_info = f" (DOWN for {hours}h {mins}m)"
                    except:
                        downtime_info = " (DOWN)"
                
                report += f"🔴 {sensor_name}\n"
                report += f"   📍 Device: {device_name}{downtime_info}\n\n"
        else:
            report += "✅ All sensors are UP!\n"
        
        return report
    
    def run_monitoring(self):
        """Main monitoring loop - UP/DOWN only"""
        self.logger.info("🚀 Starting PRTG Alerting System - UP/DOWN Monitoring Only...")
        
        # Test WhatsApp connection
        whatsapp_ready = self.test_whatsapp_connection()
        
        # Send startup notification
        startup_message = f"🚀 PRTG Alerting System Started\n\n"
        startup_message += f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        startup_message += f"🔄 Check interval: {self.check_interval} seconds\n"
        startup_message += f"🌐 PRTG Server: {self.prtg_url}\n"
        startup_message += f"📊 Monitoring: UP/DOWN transitions only\n"
        startup_message += f"📱 WhatsApp Status: {'✅ Connected' if whatsapp_ready else '❌ Not Connected'}\n"
        startup_message += f"📱 Monitoring {len([r for r in self.whatsapp_recipients if r.strip()])} WhatsApp recipients\n"
        startup_message += f"📧 Monitoring {len([r for r in self.email_recipients if r.strip()])} email recipients"
        
        if whatsapp_ready:
            for recipient in self.whatsapp_recipients:
                if recipient.strip():
                    self.send_whatsapp_alert(startup_message, recipient.strip())
        else:
            self.logger.warning("WhatsApp API not ready. Startup notification not sent.")
        
        consecutive_errors = 0
        max_consecutive_errors = 5
        
        while True:
            try:
                self.logger.info(f"🔍 Checking sensors at {datetime.now().strftime('%H:%M:%S')}")
                sensors = self.fetch_sensors()
                
                if sensors:
                    self.check_status_changes(sensors)
                    consecutive_errors = 0  # Reset error counter on success
                else:
                    consecutive_errors += 1
                    self.logger.warning(f"⚠️ No sensors retrieved (attempt {consecutive_errors}/{max_consecutive_errors})")
                    
                    if consecutive_errors >= max_consecutive_errors:
                        error_msg = f"❌ PRTG Connection Issue\n\n"
                        error_msg += f"Failed to fetch sensors {consecutive_errors} times in a row.\n"
                        error_msg += f"⏰ Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                        error_msg += f"🌐 Server: {self.prtg_url}\n"
                        error_msg += f"Please check PRTG server connectivity."
                        
                        if self.test_whatsapp_connection():
                            for recipient in self.whatsapp_recipients:
                                if recipient.strip():
                                    self.send_whatsapp_alert(error_msg, recipient.strip())
                        consecutive_errors = 0  # Reset to avoid spam
                
                time.sleep(self.check_interval)
                
            except KeyboardInterrupt:
                shutdown_msg = f"🛑 PRTG Monitoring Stopped\n\n⏰ Stopped at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                if self.test_whatsapp_connection():
                    for recipient in self.whatsapp_recipients:
                        if recipient.strip():
                            self.send_whatsapp_alert(shutdown_msg, recipient.strip())
                self.logger.info("🛑 Monitoring stopped by user")
                break
            except Exception as e:
                consecutive_errors += 1
                self.logger.error(f"❌ Error in monitoring loop (attempt {consecutive_errors}): {e}")
                time.sleep(30)  # Wait before retrying

def main():
    if len(sys.argv) > 1:
        alerting_system = PRTGAlertingSystem()
        
        if sys.argv[1] == "test":
            # Test mode - show current status
            report = alerting_system.generate_status_report()
            print(report)
            return
        elif sys.argv[1] == "report":
            # Generate and send report
            report = alerting_system.generate_status_report()
            print(report)
            for recipient in alerting_system.whatsapp_recipients:
                if recipient.strip():
                    alerting_system.send_whatsapp_alert(report, recipient.strip())
            return
        elif sys.argv[1] == "testwhatsapp":
            # Test WhatsApp
            alerting_system.test_send_whatsapp("🧪 PRTG WhatsApp Test - UP/DOWN Monitoring System Operational")
            return
        elif sys.argv[1] == "migrate":
            # Force database migration
            alerting_system.migrate_database()
            print("Database migration completed")
            return
    
    # Normal monitoring mode
    alerting_system = PRTGAlertingSystem()
    alerting_system.run_monitoring()

if __name__ == "__main__":
    main()

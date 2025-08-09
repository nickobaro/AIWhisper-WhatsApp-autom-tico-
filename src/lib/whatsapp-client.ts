
import makeWASocket, {

  DisconnectReason,

  useMultiFileAuthState,

  fetchLatestBaileysVersion,

  Browsers,

  type WASocket,

  type WAMessage,

  isJidGroup,

} from '@whiskeysockets/baileys';

import pino from 'pino';

import { Boom } from '@hapi/boom';

import qr from 'qrcode';

import path from 'path';

import fs from 'fs/promises';

import * as db from './db';

import { generateAIResponse } from './ai';

import type { Message, Agent } from '@/types';

const WHATSAPP_AUTH_DIR = path.join(process.cwd(), 'whatsapp-auth');


/**

 * Returns the best-fit Baileys browser descriptor string for the current OS.

 * This is purely metadata WhatsApp uses for analytics — choose something

 * plausible so that connections from Linux/Windows servers do not raise

 * suspicion.

 */

function getHostBrowserDescriptor(): [string, string, string] {

  switch (process.platform) {

    case 'win32':

      return Browsers.windows('Desktop');

    case 'linux':

      // "Ubuntu" is acceptable for the vast majority of server deployments

      return Browsers.ubuntu('Desktop');

    case 'darwin':

    default:

      return Browsers.macOS('Desktop');

  }

  lastDisconnect: { reason: string; date: string } | null;

}

// Use a simple global object for state management in Next.js dev environment

declare global {

  var whatsappState: WhatsAppClientState;

  var whatsappWatchdog: NodeJS.Timer | undefined;

}


// Initialize the global state if it doesn't exist

if (!global.whatsappState) {

    global.whatsappState = {

        sock: null,

        status: 'disconnected',

        qr: null,

        account: null,

        lastDisconnect: null,

    };

}


const state = global.whatsappState;


async function handleMessage(msg: WAMessage) {

    try {

        if (!msg.message || !msg.key.remoteJid || isJidGroup(msg.key.remoteJid)) {

            return;

        }


        const chatId = msg.key.remoteJid;

        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (!messageContent) return;


        // Derive a sensible sender name. Sometimes WhatsApp supplies pushName as a single '.' or empty string.

        const rawName = (msg.pushName || '').trim();

        const senderName = rawName && rawName !== '.' ? rawName : chatId.split('@')[0];


        const message: Message = {

            id: msg.key.id!,

            chatId,

 * Initializes a new WhatsApp connection.

 * It attempts to use an existing session if available.

 */

export async function init() {

  // If a connection is already open or in progress, do nothing.

  // The UI should call logout() first if it wants a fresh start.

  // If a socket connection already exists, avoid creating another.

  if (state.sock) {

    console.log(`INIT: Skipped, current status is "${state.status}"`);

    return;

  }

  

  console.log('INIT: Starting connection process...');

  state.status = 'connecting';

  

  const { state: authState, saveCreds } = await useMultiFileAuthState(WHATSAPP_AUTH_DIR);


  // Ensure we're always using the latest WhatsApp Web version to avoid 515 errors

  const { version: waVersion } = await fetchLatestBaileysVersion();


  const sock = makeWASocket({

      logger: pino({ level: 'info' }),

      printQRInTerminal: false,

      auth: authState,

            // Choose a browser descriptor appropriate to the host OS so the code works

      // identically on macOS, Linux & Windows deployments.

      browser: getHostBrowserDescriptor(),

      markOnlineOnConnect: true,

      connectTimeoutMs: 30_000,

      syncFullHistory: false,

      version: waVersion,

  });

  

  state.sock = sock;


  // Attach event listeners

  sock.ev.on('creds.update', saveCreds);


  sock.ev.on('messages.upsert', (update) => {

    for (const msg of update.messages) {

      handleMessage(msg);

    }

  });


  sock.ev.on('connection.update', async (update) => {

    const { connection, lastDisconnect, qr: newQr } = update;

    console.log(`CONN_UPDATE: status=${connection}, qr=${!!newQr}`);


    if (newQr) {

        state.qr = await qr.toDataURL(newQr);

        if (state.status !== 'connected') {

            // Only go to connecting if we aren't already connected

            state.status = 'connecting';

        }

    }


    if (connection === 'open') {

        state.status = 'connected';

        state.qr = null;

        state.account = { id: sock.user!.id, name: sock.user!.name || 'N/A' };

        console.log('CONN_UPDATE: Connection opened successfully.');

    }


    if (connection === 'close') {

        const code = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;

        // Cleanly remove all listeners from this socket to avoid duplicate events during reconnect

        try {

            // removeAllListeners typing mismatch in Baileys; cast to any to avoid TS error

            (sock.ev as any).removeAllListeners();

        } catch (_) {/* ignore */}


        const reasonString = lastDisconnect?.error?.message || 'Unknown Disconnect';

        state.lastDisconnect = { reason: `Error: ${reasonString}`, date: new Date().toISOString() };


        // Reconnect automatically for all reasons except an explicit logout

        // Avoid reconnect loop if our session was replaced elsewhere (code 440)

        const shouldReconnect = code !== DisconnectReason.loggedOut && code !== DisconnectReason.connectionReplaced;


        if (shouldReconnect) {

            console.log(`CONN_UPDATE: Connection closed (code=${code}). Attempting automatic reconnect...`);

            // Notify UI that we're attempting to restore the session

            state.status = 'connecting';

            state.sock = null;

            state.account = null;

            // Give WhatsApp a short breather before trying again

            setTimeout(() => {

                init().catch((err) => console.error('Re-init failed:', err));

            }, 1000);

        } else {

            console.log(`CONN_UPDATE: Logged out by user/device (code=${code}). Waiting for QR rescan.`);

            state.status = 'disconnected';

            state.sock = null;

            state.account = null;

        }

    }

  });

}


// ----------------- Watchdog -----------------

if (!global.whatsappWatchdog) {

    global.whatsappWatchdog = setInterval(() => {

        if (!state.sock || state.status !== 'connected') {

            console.warn('WATCHDOG: Socket not connected, attempting re-init...');

            init().catch(err => console.error('WATCHDOG: Re-init failed', err));

        }

    }, 30_000);

}


// Trigger initial connection on first import

if (state.status === 'disconnected' && !state.sock) {

    console.log('AUTO_INIT: No active socket, starting initial WhatsApp connect...');

    init().catch(err => console.error('AUTO_INIT failed:', err));

}


export function getClientState() {

  return {

    status: state.status,

    qr: state.qr,

    account: state.account,

    lastDisconnect: state.lastDisconnect,

  };

}


export async function sendMessage(to: string, text: string) {

    if (!state.sock || state.status !== 'connected') {

        throw new Error('WhatsApp client not connected.');

    }

    const sendResult = await state.sock.sendMessage(to, { text });

    // Baileys types changed: sendMessage may return object or array

    const result = (Array.isArray(sendResult) ? sendResult[0] : sendResult) as any;

    

    const message: Message = {

        id: result.key.id!,

        chatId: to,

        fromMe: true,

        text: text,

        timestamp: Date.now(),

        senderName: 'Me',

    };


    await db.addMessage(message);

    await db.updateConversation(to, {

        lastMessage: { text: message.text, timestamp: message.timestamp },

        unreadCount: 0,

    });

    await db.incrementStat('sent');


    return result;

}

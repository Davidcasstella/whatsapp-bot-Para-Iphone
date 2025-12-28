// Bot de WhatsApp para Outlet Tech Boyacá - iPhone Store
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// 📁 Configuración de multer para subir audio
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const audioDir = path.join(__dirname, 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }
    cb(null, audioDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'saludo-daniela.ogg');
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['audio/ogg', 'audio/mpeg', 'audio/mp3', 'application/octet-stream'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.ogg') || file.originalname.endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de audio no permitido. Usa OGG o MP3.'));
    }
  }
});

let sock;
let qrCodeData = null;
let isConnected = false;
let isConnecting = false;
let miNumero = null;
const PORT = 3000;

// 📋 CONFIGURACIÓN DINÁMICA
const CONFIG_FILE = path.join(__dirname, 'bot-config.json');

function cargarConfiguracion() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      const config = JSON.parse(data);
      console.log('✅ Configuración cargada desde archivo');
      return config;
    }
  } catch (error) {
    console.log('⚠️ Error cargando configuración:', error.message);
  }
  
  // Configuración por defecto
  return {
    empresa_nombre: "Outlet Tech Boyacá",
    empresa_telefono: "305 2707907",
    empresa_direccion: "Calle 11a # 9-27, Tunja, Boyacá",
    empresa_maps: "https://maps.app.goo.gl/tGE9JvRz49DyYrAk7",
    cooldown: 60,
    msg_texto_libre: "Vale ya te respondo",
    menu_principal: `Soy Johana, ¿en qué puedo ayudarte? 😊

1. 📱 Listado de iPhone
2. 🔌 Accesorios para iPhone
3. 💻 Listado de MacBook
4. 📍 Ubicación del negocio

Escribe el número de tu opción`,
    catalogo_iphones: `📱 *LISTADO DE iPHONES*

1. iPhone 13 — 128 GB
   Colores: Negro, Blanco Estelar, Azul, Rosa, Rojo, Verde

(...)

📞 Para precios y disponibilidad escríbenos al 305 2707907`,
    accesorios_iphone: `🍎 *ACCESORIOS APPLE – IPHONE*

🔋 *Carga y energía*
• Adaptador de corriente Apple USB-C (20W / 30W / 35W)
(...)`,
    catalogo_macbooks: `💻 *LISTADO DE MACBOOKS POR PROCESADOR*

1. Core i5
   Modelo 2019–2020, RAM 8 GB, pantalla 13", 256 GB SSD
(...)`,
    accesorios_macbook: `💻 *ACCESORIOS APPLE – MACBOOK*

🔌 *Carga y conectividad*
• Adaptador de corriente Apple USB-C
(...)`,
    compatibilidad: `📦 *COMPATIBILIDAD*

iPhone 11 / 12 / 13 / 14 / 15 / 16
MacBook Air M1 / M2 / M3 / M4
MacBook Pro M1 / M2 / M3 / M4`,
    horario: `⏰ *Horario*
Lunes a Sábado: 7:00 AM - 8:00 PM
Domingos: 8:00 AM - 11:00 AM`
  };
}

let CONFIG = cargarConfiguracion();

// 🔄 FUNCIÓN PARA RECARGAR CONFIGURACIÓN EN TIEMPO REAL
function recargarConfiguracion() {
  CONFIG = cargarConfiguracion();
  console.log('🔄 Configuración recargada en tiempo real');
  return CONFIG;
}

// Control de mensajes procesados y cooldowns
const mensajesProcesados = new Set();
const usuariosCooldown = new Map();
const estadoUsuarios = new Map();

// Limpiar mensajes antiguos cada 5 minutos
setInterval(() => {
  mensajesProcesados.clear();
  console.log('🧹 Cache de mensajes limpiado');
}, 300000);

// Verificar si un usuario está en cooldown
function estaEnCooldown(telefono) {
  const COOLDOWN_MS = CONFIG.cooldown * 60 * 1000;
  
  if (!usuariosCooldown.has(telefono)) {
    return false;
  }
  
  const ultimaRespuesta = usuariosCooldown.get(telefono);
  const tiempoTranscurrido = Date.now() - ultimaRespuesta;
  
  if (tiempoTranscurrido < COOLDOWN_MS) {
    const minutosRestantes = Math.ceil((COOLDOWN_MS - tiempoTranscurrido) / 60000);
    return minutosRestantes;
  }
  
  usuariosCooldown.delete(telefono);
  return false;
}

async function connectToWhatsApp() {
  if (isConnecting) {
    console.log('⚠️ Ya hay una conexión en proceso...');
    return;
  }
  
  if (isConnected) {
    console.log('⚠️ Ya está conectado a WhatsApp');
    return;
  }
  
  isConnecting = true;
  
  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      defaultQueryTimeoutMs: undefined,
      browser: ['Chrome (Linux)', '', ''],
      syncFullHistory: false,
      markOnlineOnConnect: true,
      emitOwnEvents: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        qrCodeData = qr;
        console.log('\n📱 Código QR disponible en: http://localhost:3000');
        qrcode.generate(qr, { small: true });
      }
      
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        console.log(`❌ Conexión cerrada. Status: ${statusCode}`);
        isConnected = false;
        isConnecting = false;
        qrCodeData = null;
        miNumero = null;
        
        if (shouldReconnect) {
          console.log('🔄 Reconectando en 5 segundos...');
          setTimeout(() => connectToWhatsApp(), 5000);
        } else {
          console.log('\n⛔ SESIÓN CERRADA');
          console.log('🌐 Ve a http://localhost:3000 para limpiar sesión\n');
        }
      } else if (connection === 'open') {
        console.log('✅ ¡Conectado a WhatsApp!');
        
        try {
          const user = sock.user;
          if (user && user.id) {
            miNumero = user.id.split(':')[0];
            console.log(`📱 Mi número: ${miNumero}`);
          }
        } catch (e) {
          console.log('⚠️ No se pudo obtener el número');
        }
        
        console.log('🌐 Panel de control: http://localhost:3000');
        console.log('📝 Editor de mensajes: http://localhost:3000/editor.html\n');
        isConnected = true;
        isConnecting = false;
        qrCodeData = null;
      }
    });

    // 🔥 RECIBIR MENSAJES
    sock.ev.on('messages.upsert', async (m) => {
      try {
        if (m.type !== 'notify') return;
        
        const msg = m.messages[0];
        if (!msg.message) return;
        if (msg.key.fromMe) return;
        
        const from = msg.key.remoteJid;
        const messageId = msg.key.id;
        
        if (from === 'status@broadcast') return;
        
        const remitente = from.split('@')[0];
        if (miNumero && remitente === miNumero) {
          console.log('⛔ Ignorando mensaje de mi propio número');
          return;
        }
        
        const idUnico = `${from}-${messageId}`;
        
        if (mensajesProcesados.has(idUnico)) {
          console.log('⛔ Mensaje ya procesado');
          return;
        }
        
        mensajesProcesados.add(idUnico);
        
        const text = (msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || '').trim();
        
        const telefono = from.split('@')[0];
        console.log(`\n📩 Mensaje de ${telefono}: ${text}`);

        // 🔄 RECARGAR CONFIGURACIÓN ANTES DE PROCESAR
        recargarConfiguracion();

        await manejarMensaje(from, text, telefono);

      } catch (error) {
        console.error('❌ Error procesando mensaje:', error.message);
      }
    });
  } catch (error) {
    console.error('❌ Error en conexión:', error.message);
    isConnecting = false;
  }
}

// 🎯 MANEJAR MENSAJES Y MENÚ INTERACTIVO
async function manejarMensaje(from, text, telefono) {
  try {
    const estadoActual = estadoUsuarios.get(from) || 'inicial';
    
    console.log(`📊 Estado: ${estadoActual}`);

    await sock.sendPresenceUpdate('composing', from);

    const esNuevoUsuario = !estadoUsuarios.has(from);
    const comandosInicio = ['hola', 'menu', 'inicio', 'ola', 'hi', 'hello', 'buenas'];
    const esComandoInicio = comandosInicio.some(cmd => text.toLowerCase().includes(cmd));
    const esOpcionMenu = ['1', '2', '3', '4', '0'].includes(text.trim());

    const minutosRestantes = estaEnCooldown(from);
    const estaEnMenuActivo = estadoActual === 'menu_principal' || estadoActual === 'viendo_productos';
    
    const esNumeroSolo = /^[0-9]+$/.test(text.trim());
    const comandosReactivar = ['menu', 'inicio', 'hola'];
    const quiereReactivar = esNumeroSolo || comandosReactivar.some(cmd => text.toLowerCase().includes(cmd));
    const estaEsperandoAsesor = estadoActual === 'esperando_asesor';

    if (minutosRestantes && !estaEnMenuActivo && !esComandoInicio && !(estaEsperandoAsesor && quiereReactivar)) {
      console.log(`⏳ Cooldown: ${minutosRestantes} min\n`);
      await sock.sendPresenceUpdate('paused', from);
      return;
    }

    if (esNuevoUsuario || esComandoInicio) {
      if (!minutosRestantes) {
        usuariosCooldown.set(from, Date.now());
      }
      
      estadoUsuarios.set(from, 'menu_principal');
      
      try {
        const rutaAudio = path.join(__dirname, 'audio', 'saludo-daniela.ogg');
        
        if (fs.existsSync(rutaAudio)) {
          const audioBuffer = fs.readFileSync(rutaAudio);
          
          await sock.sendMessage(from, {
            audio: audioBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
          });
          
          console.log(`🎤 Audio enviado a ${telefono}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error('❌ Error enviando audio:', error.message);
      }
      
      await sock.sendMessage(from, { text: CONFIG.menu_principal });
      
      console.log(`✅ Menú enviado a ${telefono}`);
      await sock.sendPresenceUpdate('paused', from);
      return;
    }

    if (estadoActual === 'menu_principal' && esOpcionMenu) {
      await procesarOpcionMenu(from, text, telefono);
    } else if (estadoActual === 'viendo_productos') {
      if (text === '0') {
        estadoUsuarios.set(from, 'menu_principal');
        await sock.sendMessage(from, { text: CONFIG.menu_principal });
        console.log(`✅ Usuario regresó al menú`);
      } else if (esOpcionMenu) {
        estadoUsuarios.set(from, 'menu_principal');
        await procesarOpcionMenu(from, text, telefono);
      } else {
        estadoUsuarios.set(from, 'esperando_asesor');
        await sock.sendMessage(from, { 
          text: CONFIG.msg_texto_libre
        });
        console.log(`👤 Usuario será atendido por asesor`);
      }
    } else if (estadoActual === 'menu_principal') {
      const tieneLetras = /[a-zA-ZáéíóúÁÉÍÓÚñÑ]/.test(text);
      
      if (tieneLetras) {
        estadoUsuarios.set(from, 'esperando_asesor');
        await sock.sendMessage(from, { 
          text: CONFIG.msg_texto_libre
        });
        console.log(`👤 Bot detenido para asesor humano`);
      } else {
        await sock.sendMessage(from, { 
          text: `⚠️ Por favor escribe *1*, *2*, *3* o *4*:\n\n${CONFIG.menu_principal}` 
        });
      }
    } else if (estadoActual === 'esperando_asesor') {
      const quiereMenu = comandosReactivar.some(cmd => text.toLowerCase().includes(cmd));
      const esNumeroSolo = /^[0-9]+$/.test(text.trim());
      
      if (quiereMenu || esNumeroSolo) {
        estadoUsuarios.set(from, 'menu_principal');
        await sock.sendMessage(from, { text: CONFIG.menu_principal });
        console.log(`✅ Bot reactivado`);
      } else {
        console.log(`🤐 Esperando asesor humano`);
      }
    }

    await sock.sendPresenceUpdate('paused', from);

  } catch (error) {
    console.error('❌ Error manejando mensaje:', error.message);
  }
}

// 🎯 PROCESAR OPCIONES DEL MENÚ
async function procesarOpcionMenu(from, text, telefono) {
  try {
    const opcion = text.trim();

    switch(opcion) {
      case '1': // Listado de iPhones
        estadoUsuarios.set(from, 'viendo_productos');
        await sock.sendMessage(from, { text: CONFIG.catalogo_iphones });
        console.log(`✅ Catálogo iPhone enviado a ${telefono}`);
        break;

      case '2': // Accesorios iPhone
        estadoUsuarios.set(from, 'viendo_productos');
        await sock.sendMessage(from, { text: CONFIG.accesorios_iphone });
        await new Promise(resolve => setTimeout(resolve, 500));
        await sock.sendMessage(from, { text: CONFIG.compatibilidad });
        console.log(`✅ Accesorios iPhone enviados a ${telefono}`);
        break;

      case '3': // Listado MacBooks
        estadoUsuarios.set(from, 'viendo_productos');
        await sock.sendMessage(from, { text: CONFIG.catalogo_macbooks });
        await new Promise(resolve => setTimeout(resolve, 500));
        await sock.sendMessage(from, { text: CONFIG.accesorios_macbook });
        await new Promise(resolve => setTimeout(resolve, 500));
        await sock.sendMessage(from, { text: CONFIG.compatibilidad });
        console.log(`✅ Catálogo MacBook enviado a ${telefono}`);
        break;

      case '4': // Ubicación
        await sock.sendMessage(from, { 
          text: `📍 *${CONFIG.empresa_nombre}*\n\n${CONFIG.empresa_direccion}\n\n${CONFIG.horario}` 
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await sock.sendMessage(from, {
          location: {
            degreesLatitude: 5.524566,
            degreesLongitude: -73.363801
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        await sock.sendMessage(from, { 
          text: `🗺️ También puedes verlo aquí:\n${CONFIG.empresa_maps}\n\n📞 Teléfono: ${CONFIG.empresa_telefono}` 
        });
        
        estadoUsuarios.set(from, 'menu_principal');
        console.log(`✅ Ubicación enviada a ${telefono}`);
        break;

      default:
        await sock.sendMessage(from, { 
          text: `⚠️ Opción no válida.\n\n${CONFIG.menu_principal}` 
        });
        break;
    }
  } catch (error) {
    console.error('❌ Error procesando opción:', error.message);
  }
}

// ==================== ENDPOINTS API ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/editor.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'editor.html'));
});

app.get('/status', (req, res) => {
  const usuariosActivos = Array.from(usuariosCooldown.entries()).map(([telefono, timestamp]) => {
    const COOLDOWN_MS = CONFIG.cooldown * 60 * 1000;
    const tiempoRestante = Math.max(0, COOLDOWN_MS - (Date.now() - timestamp));
    const minutosRestantes = Math.ceil(tiempoRestante / 60000);
    
    return {
      telefono: telefono.split('@')[0],
      ultimaRespuesta: new Date(timestamp).toLocaleString('es-CO'),
      minutosRestantes: minutosRestantes > 0 ? minutosRestantes : 0,
      puedeResponder: minutosRestantes === 0,
      estado: estadoUsuarios.get(telefono) || 'inicial'
    };
  });

  res.json({ 
    status: isConnected ? 'conectado' : 'desconectado',
    empresa: CONFIG.empresa_nombre,
    cooldownMinutos: CONFIG.cooldown,
    mensajesProcesados: mensajesProcesados.size,
    usuariosEnCooldown: usuariosActivos,
    miNumero: miNumero || 'No disponible'
  });
});

// 📝 ACTUALIZAR CONFIGURACIÓN EN TIEMPO REAL
app.post('/update-config', (req, res) => {
  try {
    const newConfig = req.body;
    
    // Guardar en archivo
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    
    // Recargar configuración inmediatamente
    CONFIG = cargarConfiguracion();
    
    console.log('✅ Configuración actualizada en tiempo real - Sin reiniciar');
    res.json({ 
      message: 'Configuración actualizada en tiempo real',
      success: true 
    });
  } catch (error) {
    console.error('❌ Error actualizando configuración:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 📝 OBTENER CONFIGURACIÓN ACTUAL
app.get('/get-config', (req, res) => {
  res.json(CONFIG);
});

// 🎤 SUBIR AUDIO DE SALUDO
app.post('/upload-audio', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo' });
    }
    
    console.log('✅ Audio subido correctamente:', req.file.filename);
    res.json({ 
      message: 'Audio actualizado correctamente',
      filename: req.file.filename,
      size: req.file.size,
      success: true
    });
  } catch (error) {
    console.error('❌ Error subiendo audio:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 📥 VERIFICAR SI EXISTE AUDIO
app.get('/check-audio', (req, res) => {
  const rutaAudio = path.join(__dirname, 'audio', 'saludo-daniela.ogg');
  const existe = fs.existsSync(rutaAudio);
  
  if (existe) {
    const stats = fs.statSync(rutaAudio);
    res.json({
      exists: true,
      size: stats.size,
      modified: stats.mtime
    });
  } else {
    res.json({ exists: false });
  }
});

app.get('/qr', (req, res) => {
  if (qrCodeData) {
    res.json({ qr: qrCodeData, connected: false });
  } else if (isConnected) {
    res.json({ qr: null, connected: true });
  } else {
    res.json({ qr: null, connected: false });
  }
});

app.post('/reset-cooldown/:telefono', (req, res) => {
  const telefono = req.params.telefono + '@s.whatsapp.net';
  
  if (usuariosCooldown.has(telefono)) {
    usuariosCooldown.delete(telefono);
    estadoUsuarios.delete(telefono);
    console.log(`✅ Cooldown eliminado para ${req.params.telefono}`);
    res.json({ 
      message: `Cooldown eliminado para ${req.params.telefono}`,
      puedeResponder: true 
    });
  } else {
    res.json({ 
      message: `El usuario ${req.params.telefono} no tiene cooldown activo` 
    });
  }
});

app.post('/reset-all-cooldowns', (req, res) => {
  const cantidad = usuariosCooldown.size;
  usuariosCooldown.clear();
  estadoUsuarios.clear();
  console.log(`✅ ${cantidad} cooldowns eliminados`);
  res.json({ 
    message: `${cantidad} cooldowns eliminados correctamente` 
  });
});

app.post('/clear-cache', (req, res) => {
  mensajesProcesados.clear();
  console.log('✅ Cache limpiado');
  res.json({ message: 'Cache limpiado correctamente' });
});

app.post('/force-reconnect', async (req, res) => {
  try {
    console.log('🔄 Reconexión forzada');
    
    if (isConnected) {
      return res.json({ 
        message: 'Ya está conectado a WhatsApp',
        success: false,
        connected: true
      });
    }
    
    if (sock) {
      try {
        sock.end();
      } catch (e) {
        console.log('⚠️ Socket cerrado');
      }
    }
    
    isConnected = false;
    isConnecting = false;
    qrCodeData = null;
    miNumero = null;
    
    setTimeout(() => {
      connectToWhatsApp();
    }, 1000);
    
    res.json({ 
      message: 'Reconexión forzada',
      success: true
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/logout', async (req, res) => {
  try {
    if (sock && isConnected) {
      await sock.logout();
      isConnected = false;
      isConnecting = false;
      qrCodeData = null;
      miNumero = null;
      console.log('✅ Sesión cerrada');
      
      setTimeout(() => {
        connectToWhatsApp();
      }, 2000);
      
      res.json({ message: 'Sesión cerrada correctamente' });
    } else {
      res.json({ message: 'No hay sesión activa' });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    isConnecting = false;
    res.status(500).json({ error: error.message });
  }
});

app.post('/clear-session', async (req, res) => {
  try {
    const authFolder = path.join(__dirname, 'auth_info');
    
    if (sock) {
      try {
        await sock.logout();
      } catch (e) {
        console.log('⚠️ Forzando cierre...');
      }
    }
    
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
      isConnected = false;
      isConnecting = false;
      qrCodeData = null;
      miNumero = null;
      console.log('✅ Sesión limpiada');
      
      setTimeout(() => {
        connectToWhatsApp();
      }, 3000);
      
      res.json({ 
        message: 'Sesión limpiada',
        needsRestart: false,
        autoReconnect: true
      });
    } else {
      console.log('📱 Creando nueva sesión');
      isConnected = false;
      isConnecting = false;
      miNumero = null;
      
      setTimeout(() => {
        connectToWhatsApp();
      }, 2000);
      
      res.json({ 
        message: 'Creando nueva sesión',
        needsRestart: false,
        autoReconnect: true
      });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    isConnecting = false;
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n📱 BOT DE WHATSAPP - ${CONFIG.empresa_nombre} 🎯`);
  console.log(`🌐 Panel: http://localhost:${PORT}`);
  console.log(`📝 Editor: http://localhost:${PORT}/editor.html`);
  console.log(`📊 API: http://localhost:${PORT}/status\n`);
  
  console.log('⚡ CARACTERÍSTICAS:');
  console.log('   • 🎤 Audio de saludo: ✅');
  console.log('   • 📱 Catálogo iPhone: ✅');
  console.log('   • 💻 Catálogo MacBook: ✅');
  console.log('   • 🔌 Accesorios: ✅');
  console.log('   • 🔄 Actualización en tiempo real: ✅');
  console.log('   • 👤 Derivación a asesor: ✅');
  console.log(`   • ⏰ Cooldown: ${CONFIG.cooldown} minutos\n`);
  
  const publicFolder = path.join(__dirname, 'public');
  if (!fs.existsSync(publicFolder)) {
    fs.mkdirSync(publicFolder);
    console.log('📁 Carpeta "public" creada\n');
  }
  
  const audioFolder = path.join(__dirname, 'audio');
  if (!fs.existsSync(audioFolder)) {
    fs.mkdirSync(audioFolder);
    console.log('📁 Carpeta "audio" creada\n');
  }
  
  connectToWhatsApp();
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Error:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Excepción:', err.message);
});
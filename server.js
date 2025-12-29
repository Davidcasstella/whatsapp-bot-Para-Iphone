// server.js - Servidor Principal Refactorizado
// Bot de WhatsApp para Outlet Tech Boyacá - iPhone Store

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Importar clases personalizadas
const ConfigManager = require('./ConfigManager');
const CooldownManager = require('./CooldownManager');
const MenuHandler = require('./MenuHandler');
const MessageProcessor = require('./MessageProcessor');
const WhatsAppConnection = require('./WhatsAppConnection');

// ==================== CONFIGURACIÓN DEL SERVIDOR ====================

const app = express();
const PORT = 3000;

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static('public'));

// ==================== CONFIGURACIÓN DE MULTER ====================

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
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['audio/ogg', 'audio/mpeg', 'audio/mp3', 'application/octet-stream'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.ogg') || file.originalname.endsWith('.mp3')) {
      cb(null, true);
    } else {
      cb(new Error('Formato de audio no permitido. Usa OGG o MP3.'));
    }
  }
});

// ==================== INICIALIZACIÓN DE CLASES ====================

// Inicializar gestor de configuración
const configManager = new ConfigManager();

// Inicializar gestor de cooldowns
const cooldownManager = new CooldownManager(configManager.obtenerConfig().cooldown);

// Inicializar variables globales (se asignarán después de la conexión)
let whatsappConnection = null;
let menuHandler = null;
let messageProcessor = null;

// ==================== FUNCIONES DE INICIALIZACIÓN ====================

async function inicializarBot() {
  // Crear procesador de mensajes (sin sock todavía)
  messageProcessor = new MessageProcessor(null, configManager, cooldownManager, null);
  
  // Crear conexión de WhatsApp
  whatsappConnection = new WhatsAppConnection(messageProcessor);
  
  // Asignar sock al procesador
  messageProcessor.sock = whatsappConnection.sock;
  
  // Crear manejador de menú
  menuHandler = new MenuHandler(null, configManager, cooldownManager);
  
  // Asignar menuHandler al procesador
  messageProcessor.menuHandler = menuHandler;
  
  // Conectar a WhatsApp
  await whatsappConnection.conectar();
  
  // Actualizar referencias cada vez que se reconecte
  const intervalo = setInterval(() => {
    if (whatsappConnection.obtenerSock()) {
      messageProcessor.sock = whatsappConnection.obtenerSock();
      menuHandler.sock = whatsappConnection.obtenerSock();
    }
  }, 1000);
}

// ==================== ENDPOINTS API ====================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/editor.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'editor.html'));
});

app.get('/status', (req, res) => {
  const config = configManager.obtenerConfig();
  const estado = whatsappConnection ? whatsappConnection.obtenerEstado() : { conectado: false };
  const estadisticas = cooldownManager.obtenerEstadisticas();
  const usuariosActivos = cooldownManager.obtenerUsuariosActivos();

  res.json({ 
    status: estado.conectado ? 'conectado' : 'desconectado',
    empresa: config.empresa_nombre,
    cooldownMinutos: config.cooldown,
    mensajesProcesados: estadisticas.mensajesProcesados,
    usuariosEnCooldown: usuariosActivos,
    miNumero: estado.miNumero || 'No disponible'
  });
});

app.post('/update-config', (req, res) => {
  try {
    const newConfig = req.body;
    
    // Guardar configuración
    const guardado = configManager.guardarConfiguracion(newConfig);
    
    if (guardado) {
      // Actualizar cooldown en tiempo real
      cooldownManager.actualizarCooldownMinutos(newConfig.cooldown);
      
      console.log('✅ Configuración actualizada en tiempo real');
      res.json({ 
        message: 'Configuración actualizada en tiempo real',
        success: true 
      });
    } else {
      res.status(500).json({ error: 'Error al guardar configuración' });
    }
  } catch (error) {
    console.error('❌ Error actualizando configuración:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/get-config', (req, res) => {
  res.json(configManager.obtenerConfig());
});

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
  if (!whatsappConnection) {
    res.json({ qr: null, connected: false });
    return;
  }

  const estado = whatsappConnection.obtenerEstado();
  const qr = whatsappConnection.obtenerQR();
  
  if (qr) {
    res.json({ qr: qr, connected: false });
  } else if (estado.conectado) {
    res.json({ qr: null, connected: true });
  } else {
    res.json({ qr: null, connected: false });
  }
});

app.post('/reset-cooldown/:telefono', (req, res) => {
  const telefono = req.params.telefono + '@s.whatsapp.net';
  cooldownManager.resetearCooldown(telefono);
  
  res.json({ 
    message: `Cooldown eliminado para ${req.params.telefono}`,
    puedeResponder: true 
  });
});

app.post('/reset-all-cooldowns', (req, res) => {
  const cantidad = cooldownManager.resetearTodosCooldowns();
  res.json({ 
    message: `${cantidad} cooldowns eliminados correctamente` 
  });
});

app.post('/clear-cache', (req, res) => {
  cooldownManager.limpiarCache();
  res.json({ message: 'Cache limpiado correctamente' });
});

app.post('/force-reconnect', async (req, res) => {
  try {
    console.log('🔄 Reconexión forzada');
    
    if (!whatsappConnection) {
      res.json({ 
        message: 'Inicializando conexión...',
        success: true
      });
      await inicializarBot();
      return;
    }

    const estado = whatsappConnection.obtenerEstado();
    
    if (estado.conectado) {
      return res.json({ 
        message: 'Ya está conectado a WhatsApp',
        success: false,
        connected: true
      });
    }
    
    whatsappConnection.forzarCierre();
    
    setTimeout(async () => {
      await whatsappConnection.conectar();
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
    if (whatsappConnection) {
      const cerrado = await whatsappConnection.cerrarSesion();
      
      if (cerrado) {
        setTimeout(() => {
          whatsappConnection.conectar();
        }, 2000);
        
        res.json({ message: 'Sesión cerrada correctamente' });
      } else {
        res.json({ message: 'No hay sesión activa' });
      }
    } else {
      res.json({ message: 'Bot no inicializado' });
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/clear-session', async (req, res) => {
  try {
    const authFolder = path.join(__dirname, 'auth_info');
    
    if (whatsappConnection) {
      try {
        await whatsappConnection.cerrarSesion();
      } catch (e) {
        console.log('⚠️ Forzando cierre...');
      }
      whatsappConnection.forzarCierre();
    }
    
    if (fs.existsSync(authFolder)) {
      fs.rmSync(authFolder, { recursive: true, force: true });
      console.log('✅ Sesión limpiada');
    }
    
    setTimeout(() => {
      if (whatsappConnection) {
        whatsappConnection.conectar();
      } else {
        inicializarBot();
      }
    }, 3000);
    
    res.json({ 
      message: 'Sesión limpiada - Generando nuevo QR',
      needsRestart: false,
      autoReconnect: true
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ==================== INICIAR SERVIDOR ====================

app.listen(PORT, () => {
  const config = configManager.obtenerConfig();
  
  console.log(`\n📱 BOT DE WHATSAPP - ${config.empresa_nombre} 🎯`);
  console.log(`🌐 Panel: http://localhost:${PORT}`);
  console.log(`📝 Editor: http://localhost:${PORT}/editor.html`);
  console.log(`📊 API: http://localhost:${PORT}/status\n`);
  
  console.log('⚡ CARACTERÍSTICAS:');
  console.log('   • 🎤 Audio de saludo: ✅');
  console.log('   • 📱 Catálogo iPhone: ✅');
  console.log('   • 💻 Catálogo MacBook: ✅');
  console.log('   • 🔌 Accesorios: ✅');
  console.log('   • 💳 Métodos de pago: ✅');
  console.log('   • 🛡️ Garantía: ✅');
  console.log('   • 🔄 Actualización en tiempo real: ✅');
  console.log('   • 👤 Derivación a asesor: ✅');
  console.log(`   • ⏰ Cooldown: ${config.cooldown} minutos\n`);
  
  // Crear carpetas necesarias
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
  
  // Inicializar bot
  inicializarBot();
});

// ==================== MANEJO DE ERRORES ====================

process.on('unhandledRejection', (err) => {
  console.error('❌ Error:', err.message);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Excepción:', err.message);
});
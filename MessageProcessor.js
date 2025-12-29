// MessageProcessor.js - Procesa y clasifica mensajes entrantes
class MessageProcessor {
  constructor(sock, configManager, cooldownManager, menuHandler) {
    this.sock = sock;
    this.configManager = configManager;
    this.cooldownManager = cooldownManager;
    this.menuHandler = menuHandler;
  }

  async procesarMensaje(msg, miNumero) {
    try {
      if (msg.key.fromMe) return;
      
      const from = msg.key.remoteJid;
      const messageId = msg.key.id;
      
      if (from === 'status@broadcast') return;
      
      // Validar que no sea mi propio número
      const remitente = from.split('@')[0];
      if (miNumero && remitente === miNumero) {
        console.log('⛔ Ignorando mensaje de mi propio número');
        return;
      }
      
      // Verificar duplicados
      if (this.cooldownManager.esMensajeDuplicado(from, messageId)) {
        return;
      }
      
      // Extraer texto del mensaje
      const text = (msg.message.conversation || 
                   msg.message.extendedTextMessage?.text || '').trim();
      
      const telefono = from.split('@')[0];
      console.log(`\n📩 Mensaje de ${telefono}: ${text}`);

      // Recargar configuración antes de procesar
      this.configManager.recargarConfiguracion();

      await this.manejarMensaje(from, text, telefono);

    } catch (error) {
      console.error('❌ Error procesando mensaje:', error.message);
    }
  }

  async manejarMensaje(from, text, telefono) {
    try {
      const estadoActual = this.cooldownManager.obtenerEstado(from);
      
      console.log(`📊 Estado: ${estadoActual}`);

      await this.sock.sendPresenceUpdate('composing', from);

      const esNuevoUsuario = estadoActual === 'inicial';
      const esComandoInicio = this.menuHandler.esComandoInicio(text);
      const esOpcionMenu = this.menuHandler.esOpcionMenu(text);

      const minutosRestantes = this.cooldownManager.estaEnCooldown(from);
      const estaEnMenuActivo = estadoActual === 'menu_principal' || estadoActual === 'viendo_productos';
      
      const esNumeroSolo = /^[0-9]+$/.test(text.trim());
      const comandosReactivar = ['menu', 'inicio', 'hola'];
      const quiereReactivar = esNumeroSolo || comandosReactivar.some(cmd => text.toLowerCase().includes(cmd));
      const estaEsperandoAsesor = estadoActual === 'esperando_asesor';

      // Verificar cooldown (excepto si está en menú activo o quiere reiniciar)
      if (minutosRestantes && !estaEnMenuActivo && !esComandoInicio && !(estaEsperandoAsesor && quiereReactivar)) {
        console.log(`⏳ Cooldown: ${minutosRestantes} min\n`);
        await this.sock.sendPresenceUpdate('paused', from);
        return;
      }

      // Nuevo usuario o comando de inicio
      if (esNuevoUsuario || esComandoInicio) {
        if (!minutosRestantes) {
          this.cooldownManager.registrarRespuesta(from);
        }
        
        await this.menuHandler.mostrarMenuPrincipal(from, telefono);
        await this.sock.sendPresenceUpdate('paused', from);
        return;
      }

      // Usuario en menú principal
      if (estadoActual === 'menu_principal' && esOpcionMenu) {
        await this.menuHandler.procesarOpcionMenu(from, text, telefono);
      } 
      // Usuario viendo productos
      else if (estadoActual === 'viendo_productos') {
        if (text === '0') {
          this.cooldownManager.establecerEstado(from, 'menu_principal');
          await this.sock.sendMessage(from, { 
            text: this.configManager.obtenerConfig().menu_principal 
          });
          console.log(`✅ Usuario regresó al menú`);
        } else if (esOpcionMenu) {
          this.cooldownManager.establecerEstado(from, 'menu_principal');
          await this.menuHandler.procesarOpcionMenu(from, text, telefono);
        } else {
          await this.derivarAsesor(from, telefono);
        }
      } 
      // Usuario en menú principal pero escribió texto
      else if (estadoActual === 'menu_principal') {
        const tieneLetras = /[a-zA-ZáéíóúÁÉÍÓÚñÑ']/.test(text);
        
        if (tieneLetras) {
          await this.derivarAsesor(from, telefono);
        } else {
          await this.sock.sendMessage(from, { 
            text: `⚠️ Por favor escribe *1*, *2*, *3*, *4*, *5* o *6*:\n\n${this.configManager.obtenerConfig().menu_principal}` 
          });
        }
      } 
      // Usuario esperando asesor
      else if (estadoActual === 'esperando_asesor') {
        const quiereMenu = comandosReactivar.some(cmd => text.toLowerCase().includes(cmd));
        const esNumeroSolo = /^[0-9]+$/.test(text.trim());
        
        if (quiereMenu || esNumeroSolo) {
          this.cooldownManager.establecerEstado(from, 'menu_principal');
          await this.sock.sendMessage(from, { 
            text: this.configManager.obtenerConfig().menu_principal 
          });
          console.log(`✅ Bot reactivado`);
        } else {
          console.log(`🤐 Esperando asesor humano`);
        }
      }

      await this.sock.sendPresenceUpdate('paused', from);

    } catch (error) {
      console.error('❌ Error manejando mensaje:', error.message);
    }
  }

  async derivarAsesor(from, telefono) {
    this.cooldownManager.establecerEstado(from, 'esperando_asesor');
    await this.sock.sendMessage(from, { 
      text: this.configManager.obtenerConfig().msg_texto_libre
    });
    console.log(`👤 Bot detenido - Usuario será atendido por asesor`);
  }
}

module.exports = MessageProcessor;
// MenuHandler.js - Maneja toda la lógica del menú interactivo
const path = require('path');
const fs = require('fs');

class MenuHandler {
  constructor(sock, configManager, cooldownManager) {
    this.sock = sock;
    this.configManager = configManager;
    this.cooldownManager = cooldownManager;
  }

  async enviarAudioSaludo(from) {
    try {
      const rutaAudio = path.join(__dirname, 'audio', 'saludo-daniela.ogg');
      
      if (fs.existsSync(rutaAudio)) {
        const audioBuffer = fs.readFileSync(rutaAudio);
        
        await this.sock.sendMessage(from, {
          audio: audioBuffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        });
        
        console.log(`🎤 Audio enviado a ${from.split('@')[0]}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      }
    } catch (error) {
      console.error('❌ Error enviando audio:', error.message);
    }
    return false;
  }

  async mostrarMenuPrincipal(from, telefono) {
    const config = this.configManager.obtenerConfig();
    
    // Enviar audio de saludo
    await this.enviarAudioSaludo(from);
    
    // Enviar menú principal
    await this.sock.sendMessage(from, { text: config.menu_principal });
    
    // Establecer estado y cooldown
    this.cooldownManager.establecerEstado(from, 'menu_principal');
    
    console.log(`✅ Menú enviado a ${telefono}`);
  }

  async procesarOpcionMenu(from, opcion, telefono) {
    const config = this.configManager.obtenerConfig();

    try {
      await this.sock.sendPresenceUpdate('composing', from);

      switch(opcion) {
        case '1': // Listado de iPhones
          this.cooldownManager.establecerEstado(from, 'viendo_productos');
          await this.sock.sendMessage(from, { text: config.catalogo_iphones });
          console.log(`✅ Catálogo iPhone enviado a ${telefono}`);
          break;

        case '2': // Accesorios iPhone
          this.cooldownManager.establecerEstado(from, 'viendo_productos');
          await this.sock.sendMessage(from, { text: config.accesorios_iphone });
          await new Promise(resolve => setTimeout(resolve, 500));
          await this.sock.sendMessage(from, { text: config.compatibilidad });
          console.log(`✅ Accesorios iPhone enviados a ${telefono}`);
          break;

        case '3': // Listado MacBooks
          this.cooldownManager.establecerEstado(from, 'viendo_productos');
          await this.sock.sendMessage(from, { text: config.catalogo_macbooks });
          await new Promise(resolve => setTimeout(resolve, 500));
          await this.sock.sendMessage(from, { text: config.accesorios_macbook });
          await new Promise(resolve => setTimeout(resolve, 500));
          await this.sock.sendMessage(from, { text: config.compatibilidad });
          console.log(`✅ Catálogo MacBook enviado a ${telefono}`);
          break;

        case '4': // Ubicación
          await this.enviarUbicacion(from, config);
          this.cooldownManager.establecerEstado(from, 'menu_principal');
          console.log(`✅ Ubicación enviada a ${telefono}`);
          break;

        case '5': // Métodos de pago
          this.cooldownManager.establecerEstado(from, 'viendo_productos');
          await this.sock.sendMessage(from, { text: config.metodos_pago });
          console.log(`✅ Métodos de pago enviados a ${telefono}`);
          break;

        case '6': // Garantía
          this.cooldownManager.establecerEstado(from, 'viendo_productos');
          await this.sock.sendMessage(from, { text: config.garantia });
          console.log(`✅ Información de garantía enviada a ${telefono}`);
          break;

        default:
          await this.sock.sendMessage(from, { 
            text: `⚠️ Opción no válida.\n\n${config.menu_principal}` 
          });
          break;
      }

      await this.sock.sendPresenceUpdate('paused', from);
    } catch (error) {
      console.error('❌ Error procesando opción:', error.message);
    }
  }

  async enviarUbicacion(from, config) {
    // Mensaje de texto con dirección
    await this.sock.sendMessage(from, { 
      text: `📍 *${config.empresa_nombre}*\n\n${config.empresa_direccion}\n\n${config.horario}` 
    });
    
    // Ubicación GPS
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.sock.sendMessage(from, {
      location: {
        degreesLatitude: 5.524566,
        degreesLongitude: -73.363801
      }
    });
    
    // Link de Google Maps
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.sock.sendMessage(from, { 
      text: `🗺️ También puedes verlo aquí:\n${config.empresa_maps}\n\n📞 Teléfono: ${config.empresa_telefono}` 
    });
  }

  esComandoInicio(text) {
    const comandosInicio = ['hola', 'menu', 'inicio', 'ola', 'hi', 'hello', 'buenas'];
    return comandosInicio.some(cmd => text.toLowerCase().includes(cmd));
  }

  esOpcionMenu(text) {
    return ['1', '2', '3', '4', '5', '6', '0'].includes(text.trim());
  }

  esOpcionValida(text) {
    return ['1', '2', '3', '4', '5', '6'].includes(text.trim());
  }
}

module.exports = MenuHandler;
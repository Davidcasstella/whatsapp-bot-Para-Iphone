// ConfigManager.js - Gestiona toda la configuración del bot
const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configFile = path.join(__dirname, 'bot-config.json');
    this.config = this.cargarConfiguracion();
  }

  cargarConfiguracion() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        const config = JSON.parse(data);
        console.log('✅ Configuración cargada desde archivo');
        
        // Verificar que tenga las 6 opciones en el menú
        this.verificarMenu(config);
        
        return config;
      }
    } catch (error) {
      console.log('⚠️ Error cargando configuración:', error.message);
    }
    
    return this.obtenerConfiguracionPorDefecto();
  }

  verificarMenu(config) {
    // Verificar que el menú contenga las 6 opciones
    const menuCorrecto = config.menu_principal && 
                        config.menu_principal.includes('5. 💳') && 
                        config.menu_principal.includes('6. 🛡️');
    
    if (!menuCorrecto) {
      console.log('⚠️ Menú desactualizado - Regenerando con 6 opciones');
      config.menu_principal = `Soy Johana, ¿en qué puedo ayudarte? 😊

1. 📱 Listado de iPhone
2. 🔌 Accesorios para iPhone
3. 💻 Listado de MacBook
4. 📍 Ubicación del negocio
5. 💳 Métodos de pago
6. 🛡️ Garantía

Escribe el número de tu opción`;
    }
    
    // Verificar que existan metodos_pago y garantia
    if (!config.metodos_pago) {
      console.log('⚠️ Métodos de pago no definidos - Generando por defecto');
      config.metodos_pago = this.obtenerMetodosPago(config);
    }
    
    if (!config.garantia) {
      console.log('⚠️ Garantía no definida - Generando por defecto');
      config.garantia = this.obtenerGarantia(config);
    }
  }

  obtenerConfiguracionPorDefecto() {
    const config = {
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
5. 💳 Métodos de pago
6. 🛡️ Garantía

Escribe el número de tu opción`,

      catalogo_iphones: this.obtenerCatalogoiPhones(),
      accesorios_iphone: this.obtenerAccesoriosiPhone(),
      catalogo_macbooks: this.obtenerCatalogoMacBooks(),
      accesorios_macbook: this.obtenerAccesoriosMacBook(),
      compatibilidad: this.obtenerCompatibilidad(),
      horario: this.obtenerHorario()
    };
    
    // Generar métodos de pago y garantía con la configuración
    config.metodos_pago = this.obtenerMetodosPago(config);
    config.garantia = this.obtenerGarantia(config);
    
    return config;
  }

  obtenerCatalogoiPhones() {
    const telefono = this.config?.empresa_telefono || '305 2707907';
    return `📱 *LISTADO DE iPHONES*

1. iPhone 13 – 128 GB
   Colores: Negro, Blanco Estelar, Azul, Rosa, Rojo, Verde

2. iPhone 13 Mini – 128 GB
   Colores: Negro, Blanco Estelar, Azul, Rosa, Rojo, Verde

3. iPhone 13 Pro – 256 GB
   Colores: Grafito, Plata, Oro, Azul Sierra, Verde Alpino

4. iPhone 13 Pro Max – 256 GB
   Colores: Grafito, Plata, Oro, Azul Sierra, Verde Alpino

5. iPhone 14 – 128 GB
   Colores: Negro, Blanco Estelar, Azul, Morado, Rojo, Amarillo

6. iPhone 14 Plus – 128 GB
   Colores: Negro, Blanco Estelar, Azul, Morado, Rojo, Amarillo

7. iPhone 14 Pro – 256 GB
   Colores: Negro Espacial, Plata, Oro, Morado Oscuro

8. iPhone 14 Pro Max – 256 GB
   Colores: Negro Espacial, Plata, Oro, Morado Oscuro

9. iPhone 15 – 128 GB
   Colores: Negro, Azul, Verde, Amarillo, Rosa

10. iPhone 15 Plus – 128 GB
    Colores: Negro, Azul, Verde, Amarillo, Rosa

11. iPhone 15 Pro – 256 GB
    Colores: Titanio Negro, Titanio Blanco, Titanio Azul, Titanio Natural

12. iPhone 15 Pro Max – 512 GB
    Colores: Titanio Negro, Titanio Blanco, Titanio Azul, Titanio Natural

13. iPhone 16 – 256 GB
    Colores: Negro, Blanco, Rosa, Azul Ultramarino, Verde Azulado

14. iPhone 16 Plus – 256 GB
    Colores: Negro, Blanco, Rosa, Azul Ultramarino, Verde Azulado

15. iPhone 16 Pro – 512 GB
    Colores: Titanio Negro, Titanio Blanco, Titanio Natural, Titanio Desierto

16. iPhone 16 Pro Max – 1 TB
    Colores: Titanio Negro, Titanio Blanco, Titanio Natural, Titanio Desierto

📞 Para precios y disponibilidad escríbenos al ${telefono}`;
  }

  obtenerAccesoriosiPhone() {
    const telefono = this.config?.empresa_telefono || '305 2707907';
    return `🎁 *ACCESORIOS APPLE – IPHONE*

🔋 *Carga y energía*
• Adaptador de corriente Apple USB-C (20W / 30W / 35W)
• Cable Apple USB-C a Lightning
• Cable Apple USB-C a USB-C
• MagSafe Charger Apple
• Batería MagSafe Apple

🛡️ *Protección*
• Funda Apple Silicone Case
• Funda Apple Clear Case
• Funda Apple Leather Case
• Vidrio templado premium
• Protector de cámara iPhone

🎧 *Audio*
• AirPods (2.ª generación)
• AirPods (3.ª generación)
• AirPods Pro (2.ª generación)
• AirPods Max

🧲 *MagSafe*
• Funda MagSafe
• Wallet MagSafe
• Soporte MagSafe para carro
• Cargador MagSafe Duo

📞 Para precios y disponibilidad contacta: ${telefono}`;
  }

  obtenerCatalogoMacBooks() {
    const telefono = this.config?.empresa_telefono || '305 2707907';
    return `💻 *LISTADO DE MACBOOKS POR PROCESADOR*

1. Core i5
   Modelo 2019–2020, RAM 8 GB, pantalla 13", 256 GB SSD

2. Core i7
   Modelo 2019–2020, RAM 16 GB, pantalla 15" o 16", 512 GB SSD

3. Core i9
   Modelo 2019–2020, RAM 16 GB, pantalla 16", 1 TB SSD

4. M1
   Modelo 2020, RAM 8 GB, pantalla 13", 256 GB SSD

5. M1 Pro
   Modelo 2021, RAM 16 GB, pantalla 14", 512 GB SSD

6. M2
   Modelo 2022, RAM 8 GB, pantalla 13", 256 GB SSD

7. M2 Air
   Modelo 2022–2023, RAM 8 GB, pantalla 13" o 15", 256 GB SSD

8. M2 Pro
   Modelo 2023, RAM 16 GB, pantalla 14" o 16", 512 GB SSD

9. M4
   Modelo 2024, RAM 16 GB, pantalla 14", 512 GB SSD

10. M4 Air
    Modelo 2024, RAM 8 GB, pantalla 13" o 15", 256 GB SSD

11. M4 Pro
    Modelo 2024, RAM 18 GB, pantalla 14" o 16", 512 GB SSD

📞 Para precios y disponibilidad escríbenos al ${telefono}`;
  }

  obtenerAccesoriosMacBook() {
    const telefono = this.config?.empresa_telefono || '305 2707907';
    return `💻 *ACCESORIOS APPLE – MACBOOK*

🔌 *Carga y conectividad*
• Adaptador de corriente Apple USB-C
• Cable de carga USB-C Apple
• Cable MagSafe 3 Apple
• Adaptador multipuerto USB-C Apple
• Adaptador USB-C a HDMI Apple

⌨️ *Teclado y control*
• Magic Keyboard
• Magic Keyboard con Touch ID
• Magic Mouse
• Magic Trackpad

🛡️ *Protección y uso*
• Funda Apple Leather Sleeve
• Funda Apple Sleeve
• Protector de teclado MacBook
• Protector de pantalla MacBook

📞 Para precios y disponibilidad contacta: ${telefono}`;
  }

  obtenerCompatibilidad() {
    return `📦 *COMPATIBILIDAD*

iPhone 11 / 12 / 13 / 14 / 15 / 16
MacBook Air M1 / M2 / M3 / M4
MacBook Pro M1 / M2 / M3 / M4`;
  }

  obtenerHorario() {
    return `⏰ *Horario*
Lunes a Sábado: 7:00 AM - 8:00 PM
Domingos: 8:00 AM - 11:00 AM`;
  }

  obtenerMetodosPago(config = this.config) {
    const direccion = config?.empresa_direccion || 'Calle 11a # 9-27, Tunja, Boyacá';
    const telefono = config?.empresa_telefono || '305 2707907';
    
    return `💳 *MÉTODOS DE PAGO*

💵 *Efectivo*
• Pago en efectivo en nuestra tienda

📱 *Transferencias y Apps*
• Nequi
• Daviplata
• Bancolombia (Transferencia o Botón PSE)

💳 *Tarjetas*
• Visa
• Mastercard
• American Express

🔌 *Pago de servicios*
• Codensa (Pago con recibo de luz)

📍 Todos los pagos pueden realizarse en nuestra tienda ubicada en:
${direccion}

📞 Contacto: ${telefono}`;
  }

  obtenerGarantia(config = this.config) {
    const nombre = config?.empresa_nombre || 'Outlet Tech Boyacá';
    const telefono = config?.empresa_telefono || '305 2707907';
    const direccion = config?.empresa_direccion || 'Calle 11a # 9-27, Tunja, Boyacá';
    
    return `🛡️ *GARANTÍA*

✅ *Dispositivos Nuevos*
• Garantía directamente con el fabricante (Apple)
• Cobertura según términos del fabricante
• Soporte en toda la red de servicio técnico autorizado

✅ *Dispositivos Usados*
• Garantía de 5 meses con ${nombre}
• Cobertura contra defectos de fabricación
• Soporte técnico incluido

📧 *Garantía de Email*
• Garantía del correo electrónico: DE POR VIDA
• Soporte permanente para configuración de iCloud
• Asistencia con cuenta Apple ID

📋 *Condiciones*
• Presentar factura de compra
• No aplica para daños físicos o por mal uso
• Revisión técnica sin costo

📞 Más información: ${telefono}
📍 ${direccion}`;
  }

  guardarConfiguracion(nuevaConfig) {
    try {
      // Asegurarse de que tenga las 6 opciones
      this.verificarMenu(nuevaConfig);
      
      fs.writeFileSync(this.configFile, JSON.stringify(nuevaConfig, null, 2));
      this.config = nuevaConfig;
      console.log('✅ Configuración guardada correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error guardando configuración:', error.message);
      return false;
    }
  }

  recargarConfiguracion() {
    this.config = this.cargarConfiguracion();
    console.log('🔄 Configuración recargada en tiempo real');
    return this.config;
  }

  obtenerConfig() {
    return this.config;
  }
}

module.exports = ConfigManager;
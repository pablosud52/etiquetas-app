# Reglas de Desarrollo y Convenciones del Proyecto

- Es un sistema web y portable diseñado para maquetar, gestionar e imprimir etiquetas de productos en hojas A4 de forma precisa a partir de la información de un archivo Excel. Ofrece un entorno seguro con roles diferenciados que permite a los administradores diseñar plantillas personalizadas con guías de corte y a los operadores generar los documentos de impresión de manera rápida e intuitiva.

## 1. Stack Tecnológico Principal

- **Frontend:** HTML5, CSS3, JavaScript (ES6+).
- **Backend:** Node.js (JavaScript).
- **Base de Datos:** SQLite.
- **Testing:** Jest (Unitarias e Integración con `supertest`).

---

## 2. Estilo de Código y Convenciones

- **Nomenclatura:** Usar `camelCase` estrictamente para variables, funciones, métodos y propiedades de objetos.
- **Arquitectura:** Estructura modular y limpia (separación clara entre rutas, controladores, servicios y acceso a datos).
- **Frontend:** Mantener HTML semántico, CSS limpio y JavaScript estructurado en módulos (ES Modules o funciones modulares aisladas).

---

## 3. Manejo de Errores

- **Backend (Node.js & SQLite):**
  - Todas las operaciones asíncronas y consultas a SQLite deben estar en un bloque `try/catch`.
  - Usar un middleware centralizado en Express para la captura global de errores.
  - Devolver respuestas de error con formato JSON unificado: `{ "error": "Mensaje legible" }`.
  - Registrar eventos usando librerías de log profesional (Pino/Winston) con niveles bien definidos (`info`, `warn`, `error`). Queda **prohibido** el uso de `console.log` en código final.
- **Frontend (JS Nativo):**
  - Implementar `try/catch` en todas las peticiones asíncronas (`fetch`).
  - Mostrar alertas o mensajes amigables en la UI para el usuario; nunca exponer errores técnicos o trazas del backend.

---

## 4. Estrategia de Testing (Jest)

- Todo nuevo módulo, servicio o endpoint debe contar con sus respectivas pruebas unitarias o de integración.
- **Pruebas Unitarias:** Aislar funciones de lógica de negocio y validaciones.
- **Pruebas de Integración:** Probar endpoints de API y persistencia en SQLite usando Jest y `supertest`.
- Ejecutar y verificar que los tests pasen con éxito antes de dar una tarea por finalizada.

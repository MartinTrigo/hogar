# Conectar HOGAR con una planilla (para que Luna y Martín vean lo mismo)

Sin esto la app anda igual, pero cada teléfono tiene solo lo suyo.
Se hace una sola vez, desde la computadora, unos 10 minutos.

1. **Crear la planilla.** En Drive: Nuevo → Hojas de cálculo. Nombre: `HOGAR`.
   Compartirla con Luna si quieren que ella también la pueda mirar.
2. **Pegar el script.** En la planilla: Extensiones → Apps Script. Borrar lo
   que haya y pegar todo `Code.gs`. Guardar (💾).
3. **Preparar.** Arriba elegir la función `configurar` → Ejecutar. Google pide
   permisos (planilla y Drive): aceptarlos. Crea las hojas, la carpeta
   `HOGAR · Papeles` en tu Drive y **una clave** (cuatro palabras, ej.
   `nogal-huerta-mate-brote-42`) que aparece abajo, en el registro. Anotarla:
   va en los dos teléfonos. Para volver a verla: ejecutar `verClave`.
4. **Publicar.** Implementar → Nueva implementación → tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   Copiar la dirección que termina en `/exec`.
5. **En cada teléfono:** HOGAR → Ajustes → "Compartir entre los dos
   teléfonos": pegar la dirección y la clave → Conectar.

## Si se cambia el script más adelante

Implementar → **Administrar implementaciones** → lápiz → Versión: **Nueva
versión**. Nunca "Nueva implementación": cambia la dirección y habría que
volver a cargarla en los dos teléfonos.

## Qué queda dónde

- Hoja `movimientos`: un renglón por gasto o ingreso. Se puede mirar y filtrar,
  pero **no conviene editarla a mano**: la app no se entera de cambios hechos
  ahí (gana siempre lo que tenga el `mod` más nuevo).
- Hoja `papeles`: la lista de papeles. Los archivos quedan **en los dos
  lados**: en la carpeta `HOGAR · Papeles` de Drive (la copia segura) y dentro
  de la app en cada teléfono, que los baja todos apenas sincroniza, para
  abrirlos sin señal.
- Hoja `ajustes`: nombres, categorías y presupuestos, en una celda.
- La dirección y la clave **nunca** van al repositorio (es público).

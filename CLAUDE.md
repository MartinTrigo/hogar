# HOGAR — contexto del proyecto

App para llevar la plata de la casa de **Martín y Luna**: gastos e ingresos de
cada uno, en qué se va (torta por categoría), cómo viene el mes, informes de
varios meses, cuentas entre los dos y los **papeles importantes** (seguro del
auto, contrato, DNI…) a mano y con aviso de vencimiento.

No es parte de AMA (que es el sistema agroecológico): vive al lado, en
`C:\MARTO\INFORMATICA\Hogar`. Se armó el 03/11/2026 sobre la base de AMA
Economía (misma letra, misma forma de sincronizar, mismo estilo de código).

## Cómo está hecha

PWA en HTML/CSS/JS puro, sin compilar. Un archivo por pestaña:

| Archivo | Qué hace |
|---|---|
| `js/util.js` | formato de plata y fechas, toast, modal |
| `js/datos.js` | los datos, `localStorage`, categorías por defecto, consultas |
| `js/graficos.js` | torta (anillo), barras y columnas en SVG, sin librerías |
| `js/cargar.js` | formulario de carga; también corrige y borra |
| `js/mes.js` | resumen del mes: avisos, torta, ritmo, comparación, quién y cómo |
| `js/movimientos.js` | la lista con buscador y filtros |
| `js/informes.js` | varios meses, una categoría de cerca, tabla, cuentas, CSV, imprimir |
| `js/papeles.js` | papeles; los archivos en IndexedDB y en Drive |
| `js/sincro.js` | sincronización con la planilla |
| `js/ajustes.js` | temas, nombres, categorías y presupuesto, respaldo |
| `apps-script/Code.gs` | el servidor (pasos en `apps-script/LEEME.md`) |

Vista previa: `hogar` en `AMA\.claude\launch.json` (puerto 8650).

## Reglas

1. **Claves con prefijo `hogar_`** y base IndexedDB `hogar`. Si se publica en
   martintrigo.github.io comparte sitio con AMA y BioSalud: nunca "borrar datos
   del sitio"; el service worker borra solo cachés `hogar-*`.
2. **Todo lo que modifique un registro pone `mod: Date.now()`**: si no, no viaja.
   Borrar = `borrado: true` (tumba), para que el otro teléfono se entere.
3. **Al cambiar archivos, subir `CACHE` en `sw.js`** y `VERSION_APP` en `js/app.js`.
4. La dirección del script y la clave viven solo en el teléfono (`hogar_local`).
5. Probar con datos simulados y borrar después las claves `hogar_*`.

## Decisiones

- **Colores de los gráficos:** ocho, en orden fijo (paleta validada para
  daltonismo, versión clara y oscura). Cada categoría tiene su color para
  siempre (`color` 1–8); las que tienen 0 van juntas en "Otros", en gris. Más
  de ocho colores ya no se distinguen.
- **Comparar con el mes anterior hasta el mismo día** si el mes está en curso.
- **Proyección a fin de mes** = fijos + variable ÷ días pasados × días del mes,
  desde el día 5.
- **Cuentas entre ustedes:** solo gastos del hogar pagados de un bolsillo (no
  la cuenta común ni lo personal), repartidos según `reparto` (% de Martín).
- **Fijos:** un gasto marcado "se repite" aparece al mes siguiente como
  aviso para cargarlo con un toque.
- **Vetas de madera:** ruido SVG (`feTurbulence`) estirado, con anillos
  sacados de las curvas de nivel. Sin imágenes.
- **Papeles:** fotos achicadas a 2000 px; tope 15 MB. El archivo se guarda en
  el teléfono (sirve sin señal) y en Drive; el otro teléfono lo baja la
  primera vez que lo abre. El script solo entrega archivos de su carpeta.

## Pendiente

Ver `PENDIENTES.md`.

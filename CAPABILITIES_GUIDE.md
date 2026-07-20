# Property Capabilities Guide

Este documento explica el sistema de capabilities que controla cómo se comportan las propiedades en PathBranching.

## 🎯 Las 5 Capabilities Principales

### 1. **Available in conditions** (conditionReadable)
- **¿Qué hace?** Permite usar el valor de esta propiedad en decisiones y chequeos lógicos
- **Ejemplo**: Si una propiedad "Health" tiene esto activo, puedes crear condiciones como "If Health > 50"
- **Por defecto**: ✅ Activado (true)
- **Buen para**: Valores que representan estado del mundo (vida, puntos, inventario)

### 2. **Writable in actions** (actionWritable)
- **¿Qué hace?** Permite que los eventos/acciones cambien el valor de esta propiedad
- **Ejemplo**: Una acción "Heal" puede aumentar la propiedad "Health"
- **Por defecto**: ✅ Activado para propiedades locales, ❌ Desactivado para propiedades canon
- **Buen para**: Valores mutables (variables de juego, inventario, estado)

### 3. **Grantable** (grantable)
- **¿Qué hace?** Permite que el sistema "otorgue" o "conceda" valores de esta propiedad al jugador
- **Ejemplo**: El jugador obtiene un arma (propiedad "Weapons" → [sword, shield])
- **Por defecto**: ❌ Desactivado (false)
- **Buen para**: Recursos, recompensas, desbloqueables

### 4. **Can be used as character** (entityPresentable)
- **¿Qué hace?** Los valores de esta propiedad aparecen como opciones de "personajes" en eventos de diálogo
- **Ejemplo**: Una propiedad "Allies" con entityPresentable=true hace que "Allies" validos sean opciones de hablantes en diálogos
- **Por defecto**: ❌ Desactivado (false)
- **Buen para**: Referencias a entidades (personajes, items, ubicaciones que pueden "hablar")
- **Nota**: Cuando activas esto, puedes elegir si esa propiedad también activa "Dialogue trigger source"

### 5. **Dialogue trigger source** (dialogueTrigger)
- **¿Qué hace?** El valor de esta propiedad puede iniciar un diálogo automáticamente basado en su contenido
- **Ejemplo**: Una propiedad "CurrentConversation" puede automáticamente mostrar el diálogo correspondiente
- **Por defecto**: ❌ Desactivado (false)
- **Visible solo si**: "Can be used as character" está activado
- **Buen para**: Flujos de diálogo que se activan por cambios de estado

---

## 🔗 "Can relate to" (relationTargetTypes)

Este es un campo **adicional** que especifica a **qué TIPOS** una propiedad puede hacer referencia:

### ¿Qué es?
Un lista de tipos de entidades que esta propiedad puede contener o referencia. Es una restricción de validación.

### Ejemplos:
- **Propiedad "Companions"**: Escribe `character` → solo puede contener referencias a entidades tipo "character"
- **Propiedad "LocationHistory"**: Escribe `location` → solo referencias a ubicaciones
- **Propiedad "Inventory"**: Escribe `item, weapon, armor` → puede contener cualquiera de estos tipos
- **Propiedad "Quest"**: Escribe `character, location, item` → la quest puede referir cualquiera de estos

### ¿Por qué importa?
- **Validación**: El sistema valida que los valores asignados sean del tipo correcto
- **Filtrado de UI**: En selectores de entidades, filtra qué entidades pueden ser elegidas
- **Documentación**: Ayuda a entender qué tipos de relaciones espera esta propiedad

### Sintaxis:
- Escribe tipos separados por comas: `character, item, location`
- Sin espacios extra (se trimean automáticamente)
- Deja vacío si la propiedad no tiene restricciones de tipo

---

## 📋 Patrones Comunes

### Pattern 1: Inventario de Armas
```
Propiedad: Weapons
- Available in conditions: ✅ (para checks como "if Weapons contains sword")
- Writable in actions: ✅ (para dar/quitar armas)
- Grantable: ✅ (para recompensas)
- Can be used as character: ❌ (las armas no hablan)
- Can relate to: weapon, equipment
```

### Pattern 2: Personajes Aliados
```
Propiedad: Allies
- Available in conditions: ✅ (para checks como "if count(Allies) > 2")
- Writable in actions: ✅ (para agregar/remover aliados)
- Grantable: ❌ (no se "otorgan", se ganan en combate/historia)
- Can be used as character: ✅ (los aliados pueden hablar en diálogos)
- Can relate to: character
```

### Pattern 3: Historial de Conversación
```
Propiedad: CurrentConversation
- Available in conditions: ✅ (para checks de continuidad)
- Writable in actions: ✅ (para cambiar conversación)
- Grantable: ❌ (es técnico)
- Can be used as character: ✅ (si necesitas que dialogue)
- Dialogue trigger source: ✅ (para disparar diálogos automáticamente)
- Can relate to: dialogue, conversation
```

---

## ⚙️ Comportamientos Automáticos

### Desactivación en Cascada
Cuando **desactivas** "Can be used as character" (entityPresentable):
- ❌ "Dialogue trigger source" se desactiva automáticamente
- (No tiene sentido activar disparadores de diálogo si la propiedad no puede hablar)

### Valores por Defecto
- **Propiedades locales**: actionWritable=true (puedes modificarlas)
- **Propiedades canon**: actionWritable=false (la canon es de lectura)
- **Todas las propiedades**: conditionReadable=true (puedes usarlas en condiciones)

---

## 🐛 Si las Capabilities no se Activan

Si haces clic en un capability card pero no parece cambiar:

1. **Mira el feedback visual**: El círculo debe cambiar de ◯ (vacío) a ● (lleno)
2. **Espera un momento**: Los cambios se guardan automáticamente (puede tomar ~1 segundo)
3. **Recarga la propiedad**: Selecciona otra propiedad y vuelve a seleccionar
4. **Verifica en inspector**: Los valores deben persistirse incluso después de cerrar/abrir

---

## 🔗 Relación con PathBranching

Las capabilities controlan:
- **En el canvas**: Qué opciones de personajes aparecen en los speech beats
- **En las condiciones**: Qué propiedades puedes usar para decisiones lógicas
- **En las acciones**: Qué propiedades puedes modificar
- **En los eventos**: Cómo se comportan los datos del mundo durante la narrativa

El sistema usa estas capabilities para hacer que el editor sea smart y only-show relevant options.

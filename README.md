# GitHub MCP Server (`github-mcp`)

Servidor oficial basado en el protocolo **Model Context Protocol (MCP)** para automatizar operaciones sobre la API REST de GitHub de manera segura, estructurada y resiliente mediante LLMs y entornos de desarrollo como Antigravity.

---

## 1. Descripción general

### ¿Qué es este proyecto?
Este proyecto implementa un **MCP Server** desarrollado en **TypeScript** y **Node.js** que expone un conjunto de herramientas estandarizadas (*tools*) para interactuar con la plataforma **GitHub**. Utiliza el SDK oficial `@modelcontextprotocol/sdk` con transporte estándar de entrada/salida (**STDIO**) y se conecta a GitHub mediante `@octokit/rest`.

### ¿Qué problema resuelve?
Los LLMs carecen de acceso nativo y seguro a los sistemas de control de versiones y repositorios remotos. Este servidor actúa como puente seguro y desacoplado, permitiendo que el LLM:
* Comprenda las capacidades disponibles mediante contratos fuertemente tipados con **Zod**.
* Ejecute acciones reales en GitHub (creación de repositorios, gestión de ramas, lectura y escritura de archivos mediante commits atómicos, administración de issues, comentarios y etiquetas).
* Reciba respuestas estandarizadas y limpias mediante **Data Transfer Objects (DTOs)** en lugar de volcados de datos crudos (*raw payloads*).
* Opere de forma confiable ante contingencias de red o límites de tasa de la API (*rate limiting*) mediante **reintentos automáticos con retroceso exponencial (*exponential backoff*)**.
* Proteja credenciales sensibles impidiendo la fuga de tokens en logs y mensajes de error mediante **sanitización activa**.

### ¿Qué es MCP en este contexto?
**Model Context Protocol (MCP)** es un protocolo abierto y estándar que define cómo las aplicaciones de inteligencia artificial (hosts/clientes como Antigravity) descubren y ejecutan herramientas expuestas por procesos secundarios (*servers*). En este proyecto, la comunicación ocurre a través de flujos estándar `stdin` y `stdout` mediante mensajes en formato JSON-RPC 2.0, reservando `stderr` exclusivamente para bitácoras y diagnóstico.

---

## 2. Casos de uso

El servidor permite automatizar flujos habituales de desarrollo y mantenimiento en GitHub:

1. **Gestión de repositorios**:
   * Listar repositorios del usuario autenticado filtrando por tipo (`all`, `public`, `private`) con soporte de paginación.
   * Crear nuevos repositorios públicos o privados permitiendo inicialización automática (`auto_init`) y descripción personalizada.
2. **Operaciones sobre archivos y control de versiones**:
   * Leer el contenido decodificado en texto plano (`UTF-8`) de archivos en cualquier rama o referencia Git.
   * Crear o modificar archivos directamente en una rama generando un commit atómico mediante la Git Data API de GitHub.
3. **Gestión integral de issues y seguimiento de tareas**:
   * Listar issues abiertos de cualquier repositorio filtrando pull requests.
   * Abrir nuevos issues con títulos descriptivos y cuerpo formateado en Markdown.
   * Agregar comentarios de seguimiento o feedback a issues existentes.
   * Cerrar issues resueltos de forma programática.
4. **Organización del repositorio**:
   * Crear etiquetas (*labels*) personalizadas con nombre, descripción y código de color hexadecimal normalizado.

---

## 3. Arquitectura

### Diagrama de flujo de datos

El siguiente diagrama detalla el flujo de ejecución sincrónico y bidireccional entre el usuario, el entorno anfitrión, el modelo de lenguaje, el servidor MCP y la API de GitHub:

```mermaid
sequenceDiagram
    autonumber
    actor User as Usuario / Desarrollador
    participant Host as Antigravity (MCP Host)
    participant Client as LLM (MCP Client)
    participant MCP as Servidor MCP (github-mcp)
    participant GitHub as GitHub REST API

    User->>Host: Solicita una operación en lenguaje natural
    Host->>Client: Proporciona contexto del usuario y catálogo de tools MCP
    Note over Client: El LLM determina la tool requerida y valida los parámetros
    Client->>MCP: Solicitud JSON-RPC (call_tool: tool_name, params) vía STDIO (stdin)
    Note over MCP: Valida input con Zod y prepara llamada con Octokit
    MCP->>GitHub: Solicitud HTTP REST autenticada con GITHUB_TOKEN
    alt Respuesta exitosa
        GitHub-->>MCP: Respuesta HTTP 200/201 (JSON payload)
        Note over MCP: Transforma a DTO y encapsula en estructura ok(data)
        MCP-->>Client: Respuesta JSON-RPC (isError: false, content: text) vía STDIO (stdout)
    else Error transitorio o Rate Limit (429 / 403)
        GitHub-->>MCP: Error HTTP 429 / 403 (Rate Limit) o caída de red
        Note over MCP: withRetry: Exponential backoff (500ms → 1000ms → 2000ms)
        MCP->>GitHub: Reintento de la solicitud HTTP
    else Error definitivo (401 / 404 / 422 / Fallo de validación)
        GitHub-->>MCP: Error HTTP 401 / 404 / 422
        Note over MCP: Normaliza error mediante AppError y sanitiza tokens
        MCP-->>Client: Respuesta JSON-RPC (isError: true, content: text con código descriptivo)
    end
    Client-->>Host: Genera explicación en lenguaje natural basada en el resultado
    Host-->>User: Presenta la respuesta final en la interfaz
```

### Componentes del sistema

| Componente | Rol en el sistema | Responsabilidad principal |
| :--- | :--- | :--- |
| **Antigravity (Host)** | Entorno anfitrión | Inicia el proceso del servidor `github-mcp` en segundo plano, inyecta variables de entorno y canaliza la entrada y salida estándar (`stdin`/`stdout`). |
| **LLM (Client)** | Motor de razonamiento | Interpreta las solicitudes del usuario, selecciona la herramienta correspondiente según el esquema JSON Schema publicado y procesa los datos devueltos. |
| **github-mcp (Server)** | Servidor MCP | Expone las herramientas, valida la entrada con Zod, ejecuta lógica de reintentos, gestiona commits Git mediante blobs y árboles, formatea a DTOs y protege secretos. |
| **GitHub REST API** | Servicio externo | Plataforma central que aloja los repositorios, ramas, archivos, commits, issues y metadatos. Valida la autenticación mediante el `GITHUB_TOKEN`. |

**Límites de comunicación:**
* La comunicación entre Antigravity/LLM y el proceso del servidor ocurre estrictamente mediante el protocolo **MCP sobre STDIO** (JSON-RPC 2.0).
* La comunicación entre el servidor y GitHub ocurre mediante **HTTPS seguro** utilizando las APIs REST y Git Data API de GitHub.

---

## 4. Requisitos del sistema

### Requisitos obligatorios
* **Sistema Operativo**: Windows 10/11, macOS 12+ o Linux (cualquier distribución moderna compatible con Node.js).
* **Node.js**: Versión **18.0.0 o superior** (Recomendado: Node.js 20.x LTS o 22.x LTS). Se requiere soporte nativo de módulos ES (`"type": "module"`) y APIs globales de red.
* **npm**: Versión **9.x o 10.x** (incluido habitualmente con Node.js).
* **Git**: Instalado y disponible en el `PATH` del sistema.
* **Cuenta de GitHub**: Con acceso a los repositorios sobre los cuales se operará.
* **GitHub Personal Access Token (PAT)**: Clásico o Fine-grained con los permisos detallados en la sección correspondiente.
* **Antigravity**: IDE o cliente MCP configurado para interactuar con herramientas externas.

### Dependencias del proyecto
* `@modelcontextprotocol/sdk`: SDK oficial para la creación de servidores MCP.
* `@octokit/rest`: Cliente oficial de GitHub para TypeScript/JavaScript.
* `zod`: Validación de esquemas y contratos de datos en tiempo de ejecución.
* `dotenv`: Carga de variables de entorno desde archivos `.env`.
* `tsx`: Ejecución directa de TypeScript en modo desarrollo.
* `typescript`: Compilación estricta (`ES2022`, módulo `NodeNext`).
* `vitest`: Framework de testing unitario y de integración.

---

## 5. Instalación paso a paso

Seguí estos pasos para instalar y preparar el servidor desde cero:

### Paso 1: Clonar o posicionarse en el repositorio
Si aún no clonaste el proyecto:
```bash
git clone https://github.com/MarcosLuna87-Dev/ProyectoM5_LunaMarcos.git
cd ProyectoM5_LunaMarcos
```

### Paso 2: Instalar dependencias
Instalá todos los paquetes de producción y desarrollo:
```bash
npm install
```

### Paso 3: Configurar variables de entorno
Copiá la plantilla de variables de entorno disponible en el repositorio:
* En Windows (PowerShell):
  ```powershell
  Copy-Item .env.example .env
  ```
* En Linux / macOS / Bash:
  ```bash
  cp .env.example .env
  ```
Abrí el archivo `.env` resultante y configurá tu token personal de GitHub:
```env
GITHUB_TOKEN=ghp_TuTokenPersonalDeGitHubAqui
```

### Paso 4: Verificar tipos y compilar TypeScript
El proyecto incluye un script de verificación de tipos sin emisión y el script de compilación oficial:
```bash
# Verifica consistencia de tipos
npm run check

# Compila el código TypeScript a JavaScript en el directorio ./dist
npm run build
```

### Paso 5: Probar ejecución local
Podés verificar que el punto de entrada ejecutable inicie correctamente:
```bash
npm start
```
> [!NOTE]
> Al iniciar directamente en la terminal, el servidor quedará a la espera de mensajes JSON-RPC por `stdin`. Verás el mensaje informativo en `stderr`: `[INFO] Servidor github-mcp conectado via STDIO`. Para detenerlo, presioná `Ctrl + C`.

---

## 6. Scripts disponibles en `package.json`

| Comando | Descripción técnica |
| :--- | :--- |
| `npm run dev` | Ejecuta el entry point en modo desarrollo utilizando `tsx src/index.ts` sin necesidad de compilar previamente. |
| `npm run build` | Compila todo el código fuente ubicado en `src/` hacia `dist/` usando `tsc` según la configuración de `tsconfig.json`. |
| `npm start` | Inicia el servidor compilado en producción mediante `node dist/index.js`. |
| `npm run check` | Ejecuta el compilador TypeScript en modo verificación de tipos (`tsc --noEmit`). |
| `npm run inspector` | Abre la herramienta oficial `@modelcontextprotocol/inspector` apuntando a `dist/index.js` para depurar interactivamente las tools. |
| `npm test` | Ejecuta la suite de pruebas unitarias y de integración usando `vitest`. |
| `npm run test:watch` | Ejecuta `vitest` en modo interactivo con recarga en vivo ante cambios en el código. |
| `npm run test:coverage` | Ejecuta las pruebas y genera un reporte detallado de cobertura con el proveedor `@vitest/coverage-v8`. |

---

## 7. Configuración de GitHub Personal Access Token

Para que el servidor pueda autenticarse contra la API de GitHub, se requiere un **Personal Access Token (PAT)**. Podés utilizar tanto un token clásico como un token fine-grained.

### Opción A: Token Clásico (Recomendado para uso general)

1. Iniciá sesión en [GitHub](https://github.com).
2. En la esquina superior derecha, hacé clic en tu avatar y seleccioná **Settings** (Configuración).
3. En el menú lateral izquierdo, descendé hasta el final y hacé clic en **Developer settings**.
4. Seleccioná **Personal access tokens** → **Tokens (classic)**.
5. Hacé clic en **Generate new token** → **Generate new token (classic)**.
6. En **Note**, ingresá una descripción identificatoria (por ejemplo: `github-mcp-antigravity`).
7. Definí un período de expiración acorde a tu política de seguridad (ej. 30 o 90 días).
8. Marcá los siguientes **scopes / permisos**:
   * `repo`: Otorga control total sobre repositorios privados y públicos (necesario para crear repositorios, leer archivos, generar commits mediante la Git Data API y administrar issues/etiquetas).
   * `read:user`: Permite leer los datos del perfil del usuario autenticado para listar repositorios asociados.
9. Hacé clic en **Generate token** al final de la página.
10. **Copiá inmediatamente el token generado** (comienza con el prefijo `ghp_`). No podrás volver a visualizarlo una vez que abandones la página.

### Opción B: Fine-grained Token (Principio de mínimo privilegio)

1. En **Developer settings**, seleccioná **Personal access tokens** → **Fine-grained tokens**.
2. Hacé clic en **Generate new token**.
3. Asigná un nombre y una fecha de vencimiento.
4. En **Repository access**, seleccioná **All repositories** (o limitá a **Only select repositories** según tu necesidad).
5. En la sección **Repository permissions**, configurá los siguientes accesos:

| Permiso Fine-grained | Nivel de acceso | Tools asociadas | Motivo técnico |
| :--- | :--- | :--- | :--- |
| **Contents** | Read and write | `get_file_content`, `create_file` | Permite leer archivos existentes y crear blobs, árboles y commits para escribir archivos. |
| **Issues** | Read and write | `create_issue`, `list_issues`, `close_issue`, `add_comment_to_issue`, `create_label` | Permite consultar issues, crear nuevos tickets, comentar, cerrar y gestionar etiquetas de issues. |
| **Administration** | Read and write | `create_repo` | Requerido por GitHub para aprovisionar y crear nuevos repositorios bajo la cuenta. |
| **Metadata** | Read-only | Todas (`list_repositories`, etc.) | Permiso base obligatorio para consultar referencias e información básica del repositorio. |

> [!CAUTION]
> **Advertencia de seguridad**: Nunca publiques tu token en repositorios públicos, no lo envíes por canales inseguros ni lo incluyas directamente en commits. El archivo `.env` se encuentra ignorado por defecto en `.gitignore`.

---

## 8. Variables de entorno

El servidor lee las variables de entorno utilizando el paquete `dotenv`.

### Tabla de variables

| Variable | Obligatoria | Descripción | Valor por defecto / Ejemplo |
| :--- | :--- | :--- | :--- |
| `GITHUB_TOKEN` | **Sí** | Token de acceso personal de GitHub (clásico o fine-grained) utilizado para autenticar las peticiones de Octokit. | `ghp_TuTokenPersonalDeGitHubAqui` |
| `NODE_ENV` | No | Entorno de ejecución (`development` o `production`). Cuando está en `development`, habilita logs de depuración (`[DEBUG]`). | `development` |
| `DEBUG` | No | Si se define como cualquier valor verdadero, habilita la salida detallada de debug en el logger del sistema. | `1` o `true` |

### Ejemplo de archivo `.env`
Creá un archivo `.env` en la raíz del proyecto con la siguiente estructura:
```env
GITHUB_TOKEN=ghp_0123456789abcdefghijklmnopqrstuvwxyzAB
NODE_ENV=development
```

---

## 9. Configuración del MCP Server en Antigravity

Para que Antigravity detecte y cargue automáticamente este servidor MCP, debe registrarse en la configuración de servidores MCP de la aplicación.

### Ubicación del archivo de configuración

Abre Antigravity IDE.

Ve a:

```
Agent → ... → MCP Servers → Manage MCP Servers → View Raw Config
```

### Estructura de configuración

Editá el archivo `mcp_config.json` e incorporá el bloque `github-mcp` dentro del objeto `mcpServers`.

#### Configuración para Producción (Recomendada con código compilado)
```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "node",
      "args": [
        "D:\\Henry\\Proyectos Integradores\\Modulo 5\\ProyectoM5_LunaMarcos\\dist\\index.js"
      ],
      "env": {
        "GITHUB_TOKEN": "ghp_TuTokenPersonalDeGitHubAqui"
      }
    }
  }
}
```

> [!TIP]
> En Windows, si el comando `node` no se resuelve automáticamente en el entorno del host, podés especificar la ruta completa al binario, por ejemplo: `"C:\\Program Files\\nodejs\\node.exe"`. Recordá duplicar las barras invertidas (`\\`) en archivos JSON.

#### Configuración para Desarrollo (Con recarga directa vía `npx tsx`)
```json
{
  "mcpServers": {
    "github-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "D:\\Henry\\Proyectos Integradores\\Modulo 5\\ProyectoM5_LunaMarcos\\src\\index.ts"
      ],
      "env": {
        "GITHUB_TOKEN": "ghp_TuTokenPersonalDeGitHubAqui"
      }
    }
  }
}
```

### Pasos para aplicar y verificar la configuración en Antigravity
1. Guardá los cambios realizados en `mcp_config.json`.
2. Si utilizás la versión de producción, asegurate de haber ejecutado previamente `npm run build` para que el archivo `dist/index.js` exista.
3. Reiniciá Antigravity o recargá la sesión de trabajo.
4. Verificá que en el panel de herramientas MCP aparezca el servidor **`github-mcp`** con sus 9 herramientas registradas.

---

## 10. Verificación de la instalación

Realizá la siguiente lista de comprobaciones para certificar que el entorno está plenamente operativo:

- [ ] Las dependencias fueron instaladas sin errores (`npm install`).
- [ ] La compilación finalizó con éxito (`npm run build`) y generó el directorio `dist/`.
- [ ] El archivo `.env` existe en la raíz y contiene una variable `GITHUB_TOKEN` válida.
- [ ] Las pruebas automatizadas pasan en su totalidad (`npm test`).
- [ ] La configuración en `mcp_config.json` apunta a la ruta absoluta correcta de `dist/index.js` o `src/index.ts`.
- [ ] El servidor aparece activo en Antigravity.

### Prompt de verificación end-to-end
Enviá el siguiente mensaje al LLM dentro de Antigravity para probar la integración con GitHub:

> *"Por favor, utilizá la herramienta `list_repositories` para mostrarme mis últimos 3 repositorios en GitHub, indicando nombre, si es privado y cantidad de estrellas."*

**Resultado esperado**: El modelo invocará la tool `list_repositories` con `{ "per_page": 3 }` y responderá con la lista formateada de tus repositorios obtenida directamente desde la API de GitHub.

---

## 11. Documentación completa de todas las MCP Tools

El servidor expone **9 herramientas** registradas en `src/tools/index.ts`. A continuación se detalla cada una con sus especificaciones técnicas y esquemas de validación Zod.

---

### 11.1. `list_repositories`

* **Nombre exacto**: `list_repositories`
* **Descripción**: Lista repositorios del usuario autenticado de GitHub. Permite filtrar por visibilidad (`all`, `public`, `private`) y paginar la cantidad devuelta. No lista issues ni pull requests.
* **Operación GitHub**: `GET /user/repos` vía `octokit.rest.repos.listForAuthenticatedUser`.
* **Retorno**: Array de objetos con tipo `ListRepoDto`:
  * `name` (`string`): Nombre del repositorio.
  * `fullName` (`string`): Nombre completo (`owner/repo`).
  * `url` (`string`): Enlace web al repositorio en GitHub.
  * `private` (`boolean`): Indica si el repositorio es privado.
  * `stars` (`number`): Cantidad de estrellas recibidas.
  * `language` (`string | null`): Lenguaje de programación principal detectado.

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `type` | `"all" \| "public" \| "private"` | No | `"all"` | Filtra los repositorios según su tipo de visibilidad. |
| `per_page` | `number` (entero) | No | `10` | Cantidad de repositorios a devolver (rango permitido: 1 a 100). |

#### Prompts efectivos
```text
Listá mis 5 repositorios públicos más recientes en GitHub indicando lenguaje y estrellas.
```
```text
Mostrame un listado de todos mis repositorios privados.
```

---

### 11.2. `create_repo`

* **Nombre exacto**: `create_repo`
* **Descripción**: Crea un nuevo repositorio en la cuenta del usuario autenticado en GitHub. Permite configurar nombre, descripción, visibilidad (público o privado) e inicialización automática con commit y archivo `README.md`.
* **Operación GitHub**: `POST /user/repos` vía `octokit.rest.repos.createForAuthenticatedUser`.
* **Retorno**: Objeto de tipo `CreateRepoDto`:
  * `name` (`string`): Nombre del repositorio creado.
  * `fullName` (`string`): Nombre completo (`usuario/repositorio`).
  * `url` (`string`): URL pública de GitHub.
  * `description` (`string | null`): Descripción asignada.
  * `private` (`boolean`): Estado de privacidad.

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | **Sí** | — | Nombre del nuevo repositorio (3 a 100 caracteres; solo alfanuméricos, guiones, puntos y guiones bajos). |
| `description` | `string` | No | `""` | Descripción informativa del repositorio (máx. 350 caracteres). |
| `private` | `boolean` | No | `false` | Establece si el repositorio debe ser privado (`true`) o público (`false`). |
| `auto_init` | `boolean` | No | `true` | Inicializa el repositorio con un commit inicial y archivo `README.md`. |

#### Prompts efectivos
```text
Creá un nuevo repositorio privado llamado "sistema-metricas-mcp" con la descripción "Servicio para recolección de métricas internas" e inicializalo con README.
```
```text
Creá un repositorio público llamado "demo-open-source" sin descripción.
```

---

### 11.3. `create_issue`

* **Nombre exacto**: `create_issue`
* **Descripción**: Crea un nuevo issue en el repositorio de GitHub especificado indicando propietario, nombre del repositorio, título obligatorio y cuerpo descriptivo opcional en formato Markdown. Retorna el número identificador asignado y su estado inicial (`open`). No edita issues existentes.
* **Operación GitHub**: `POST /repos/{owner}/{repo}/issues` vía `octokit.rest.issues.create`.
* **Retorno**: Objeto de tipo `IssueDto`:
  * `number` (`number`): Número identificador secuencial del issue.
  * `title` (`string`): Título asignado.
  * `url` (`string`): URL en la API de GitHub.
  * `state` (`string`): Estado del issue (`"open"`).

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | `string` | **Sí** | — | Usuario u organización propietaria del repositorio (1 a 39 caracteres). |
| `repo` | `string` | **Sí** | — | Nombre del repositorio (1 a 100 caracteres alfanuméricos, `.`, `-`, `_`). |
| `title` | `string` | **Sí** | — | Título del issue (1 a 256 caracteres). |
| `body` | `string` | No | `""` | Detalle o descripción del issue en formato Markdown. |

#### Prompts efectivos
```text
Creá un issue en el repositorio "MarcosLuna87-Dev/ProyectoM5_LunaMarcos" con el título "Error en timeout de conexión" y en el cuerpo detallá los pasos para reproducir el fallo.
```

---

### 11.4. `list_issues`

* **Nombre exacto**: `list_issues`
* **Descripción**: Lista los issues en estado abierto (`state: "open"`) de un repositorio específico. Excluye automáticamente pull requests (que la API de GitHub incluye por defecto en `/issues`). Retorna número, título, URL web y estado.
* **Operación GitHub**: `GET /repos/{owner}/{repo}/issues` vía `octokit.rest.issues.listForRepo`.
* **Retorno**: Array de objetos de tipo `IssueDto`:
  * `number` (`number`): Número del issue.
  * `title` (`string`): Título del issue.
  * `url` (`string`): URL web del issue (`html_url`).
  * `state` (`string`): Estado (`"open"`).

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | `string` | **Sí** | — | Usuario u organización propietaria del repositorio. |
| `repo` | `string` | **Sí** | — | Nombre del repositorio. |
| `per_page` | `number` (entero) | No | `30` | Límite máximo de issues a retornar (1 a 100). |

#### Prompts efectivos
```text
Listá los primeros 10 issues abiertos del repositorio "facebook/react".
```
```text
Consultá qué issues abiertos tiene actualmente el repositorio "MarcosLuna87-Dev/ProyectoM5_LunaMarcos".
```

---

### 11.5. `close_issue`

* **Nombre exacto**: `close_issue`
* **Descripción**: Cierra un issue abierto en el repositorio indicado modificando su estado a `closed`. Retorna los datos actualizados del issue.
* **Operación GitHub**: `PATCH /repos/{owner}/{repo}/issues/{issue_number}` vía `octokit.rest.issues.update`.
* **Retorno**: Objeto de tipo `IssueDto` con `state: "closed"`.

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | `string` | **Sí** | — | Usuario u organización propietaria del repositorio. |
| `repo` | `string` | **Sí** | — | Nombre del repositorio. |
| `issue_number` | `number` (entero positivo) | **Sí** | — | Número identificador del issue a cerrar. |

#### Prompts efectivos
```text
Cerrá el issue #4 del repositorio "MarcosLuna87-Dev/ProyectoM5_LunaMarcos".
```

---

### 11.6. `add_comment_to_issue`

* **Nombre exacto**: `add_comment_to_issue`
* **Descripción**: Publica un nuevo comentario en un issue existente identificado por su número. Soporta formato Markdown completo en el cuerpo del mensaje.
* **Operación GitHub**: `POST /repos/{owner}/{repo}/issues/{issue_number}/comments` vía `octokit.rest.issues.createComment`.
* **Retorno**: Objeto de tipo `IssueCommentDto`:
  * `id` (`number`): Identificador único del comentario creado.
  * `url` (`string`): Enlace web directo al comentario (`html_url`).
  * `body` (`string`): Contenido en Markdown del comentario publicado.

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | `string` | **Sí** | — | Dueño del repositorio. |
| `repo` | `string` | **Sí** | — | Nombre del repositorio. |
| `issue_number` | `number` (entero positivo) | **Sí** | — | Número del issue donde se publicará el comentario. |
| `body` | `string` | **Sí** | — | Contenido o mensaje en Markdown a publicar. |

#### Prompts efectivos
```text
Agregá un comentario en el issue #2 de "MarcosLuna87-Dev/ProyectoM5_LunaMarcos" que diga: "Se ha desplegado la versión v1.0.1 en el entorno de pruebas para validar esta corrección."
```

---

### 11.7. `create_label`

* **Nombre exacto**: `create_label`
* **Descripción**: Crea una nueva etiqueta personalizada en el repositorio. Permite asignar nombre, código de color hexadecimal (con o sin `#`) y descripción explicativa.
* **Operación GitHub**: `POST /repos/{owner}/{repo}/labels` vía `octokit.rest.issues.createLabel`.
* **Retorno**: Objeto de tipo `LabelDto`:
  * `id` (`number`): ID de la etiqueta.
  * `name` (`string`): Nombre de la etiqueta.
  * `color` (`string`): Código hexadecimal sin `#` (ej. `"f29513"`).
  * `description` (`string | null`): Descripción asignada.

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | `string` | **Sí** | — | Dueño u organización del repositorio. |
| `repo` | `string` | **Sí** | — | Nombre del repositorio. |
| `name` | `string` | **Sí** | — | Nombre de la etiqueta (1 a 50 caracteres). |
| `color` | `string` | No | `"f29513"` | Color hexadecimal de 6 caracteres (ej: `"d73a4a"` o `"#d73a4a"`). |
| `description` | `string` | No | `""` | Descripción informativa del propósito de la etiqueta. |

#### Prompts efectivos
```text
Creá una etiqueta llamada "refactor" con color "#1d76db" y descripción "Tareas de refactorización de código sin cambio de comportamiento" en el repositorio "MarcosLuna87-Dev/ProyectoM5_LunaMarcos".
```

---

### 11.8. `get_file_content`

* **Nombre exacto**: `get_file_content`
* **Descripción**: Recupera y decodifica a texto plano (`UTF-8`) el contenido de un archivo alojado en un repositorio de GitHub desde una rama o commit específico. No crea ni modifica archivos.
* **Operación GitHub**: `GET /repos/{owner}/{repo}/contents/{path}` vía `octokit.rest.repos.getContent`.
* **Retorno**: Objeto de tipo `FileContentDto`:
  * `path` (`string`): Ruta relativa del archivo.
  * `content` (`string`): Contenido decodificado en UTF-8.
  * `sha` (`string`): Hash SHA del blob del archivo.

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | `string` | **Sí** | — | Dueño del repositorio. |
| `repo` | `string` | **Sí** | — | Nombre del repositorio. |
| `path` | `string` | **Sí** | — | Ruta relativa del archivo dentro del repositorio (no debe iniciar con `/`, ej: `"package.json"` o `"src/index.ts"`). |
| `branch` | `string` | No | `"main"` | Rama o referencia Git desde donde leer el archivo. |

#### Prompts efectivos
```text
Leé el contenido del archivo "package.json" en la rama "main" del repositorio "MarcosLuna87-Dev/ProyectoM5_LunaMarcos".
```
```text
Obtené el archivo "src/errors/errors.ts" en la rama "main" del repositorio "MarcosLuna87-Dev/ProyectoM5_LunaMarcos" para revisar sus clases de error.
```

---

### 11.9. `create_file`

* **Nombre exacto**: `create_file`
* **Descripción**: Crea o sobreescribe un archivo de texto en el repositorio y rama especificados generando un commit directo mediante la Git Data API de GitHub (`getRef` → `getCommit` → `createBlob` → `createTree` → `createCommit` → `updateRef`). Retorna el SHA del commit generado, su URL y las rutas impactadas.
* **Operación GitHub**: Git Data API (`git.createBlob`, `git.createTree`, `git.createCommit`, `git.updateRef`).
* **Retorno**: Objeto con los detalles del commit:
  * `commit` (`string`): Hash SHA del nuevo commit creado.
  * `url` (`string`): Enlace web directo al commit en GitHub.
  * `branch` (`string`): Rama donde se aplicó el cambio.
  * `paths` (`string[]`): Lista de rutas de archivos afectados.

#### Parámetros

| Parámetro | Tipo | Obligatorio | Valor por defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `owner` | `string` | **Sí** | — | Dueño del repositorio. |
| `repo` | `string` | **Sí** | — | Nombre del repositorio. |
| `path` | `string` | **Sí** | — | Ruta relativa del archivo a crear o sobreescribir (no debe iniciar con `/`). |
| `content` | `string` | **Sí** | — | Contenido textual completo a escribir en el archivo. |
| `message` | `string` | **Sí** | — | Mensaje descriptivo para el commit Git. |
| `branch` | `string` | No | `"main"` | Rama de destino donde se realizará el commit. |

#### Prompts efectivos
```text
Creá un archivo llamado "CHANGELOG.md" en la rama "main" del repositorio "MarcosLuna87-Dev/ProyectoM5_LunaMarcos" con el texto "# Changelog\n\n## [1.0.0] - 2026-09-27\n- Lanzamiento inicial del servidor MCP." y el mensaje de commit "docs: agregar archivo CHANGELOG inicial".
```

---

## 12. Ejemplos de uso end-to-end (Workflows)

A continuación se presentan escenarios prácticos de flujos de trabajo compuestos que combinan las herramientas del servidor:

### Escenario 1: Auditoría de issues y reporte de deuda técnica
* **Objetivo**: Consultar los issues existentes en un proyecto y, si no existe uno reportando falta de tests, crear un nuevo issue con el requerimiento.
* **Prompt del usuario**:
  > *"Revisá los issues abiertos en 'MarcosLuna87-Dev/ProyectoM5_LunaMarcos'. Si no encontrás ningún issue sobre pruebas de carga, creá uno nuevo con el título 'test: incorporar pruebas de carga para el cliente Octokit' y explicá en el cuerpo la necesidad de simular límites de tasa de la API."*
* **Secuencia de tools ejecutadas por el agente**:
  1. Ejecuta `list_issues` con `{ "owner": "MarcosLuna87-Dev", "repo": "ProyectoM5_LunaMarcos" }`.
  2. Analiza los resultados y constata la inexistencia de dicho ticket.
  3. Ejecuta `create_issue` con `{ "owner": "MarcosLuna87-Dev", "repo": "ProyectoM5_LunaMarcos", "title": "test: incorporar pruebas de carga para el cliente Octokit", "body": "..." }`.
* **Resultado**: Se crea el issue con éxito y el agente entrega el enlace directo y número del ticket generado.

### Escenario 2: Creación de repositorio e inicialización de configuración
* **Objetivo**: Crear un nuevo repositorio privado y agregar un archivo de configuración `.gitignore` mediante un commit directo.
* **Prompt del usuario**:
  > *"Creá un repositorio privado llamado 'backend-microservice' con la descripción 'Servicio backend base'. Luego creá en la rama 'main' el archivo '.gitignore' con las líneas 'node_modules/' y '.env' usando el commit 'chore: agregar gitignore inicial'."*
* **Secuencia de tools ejecutadas por el agente**:
  1. Ejecuta `create_repo` con `{ "name": "backend-microservice", "description": "Servicio backend base", "private": true, "auto_init": true }`.
  2. Una vez confirmado el repositorio, ejecuta `create_file` con `{ "owner": "<usuario_autenticado>", "repo": "backend-microservice", "path": ".gitignore", "content": "node_modules/\n.env\n", "message": "chore: agregar gitignore inicial", "branch": "main" }`.
* **Resultado**: Repositorio aprovisionado y primer commit de configuración registrado en GitHub con su respectivo enlace web.

### Escenario 3: Resolución y cierre de incidentes
* **Objetivo**: Comentar la causa raíz en un issue abierto y cerrarlo formalmente.
* **Prompt del usuario**:
  > *"En el repositorio 'MarcosLuna87-Dev/ProyectoM5_LunaMarcos', agregá un comentario en el issue #5 informando que el fallo 401 fue corregido renovando el token personal, y luego procedé a cerrar el issue."*
* **Secuencia de tools ejecutadas por el agente**:
  1. Ejecuta `add_comment_to_issue` con `{ "owner": "MarcosLuna87-Dev", "repo": "ProyectoM5_LunaMarcos", "issue_number": 5, "body": "El error 401 quedó subsanado tras actualizar el GITHUB_TOKEN con los permisos adecuados." }`.
  2. Ejecuta `close_issue` con `{ "owner": "MarcosLuna87-Dev", "repo": "ProyectoM5_LunaMarcos", "issue_number": 5 }`.
* **Resultado**: El issue recibe el comentario explicativo y pasa a estado `closed`.

### Escenario 4: Inspección de archivo de configuración y documentación
* **Objetivo**: Leer un archivo del repositorio y generar un archivo de documentación basado en su contenido.
* **Prompt del usuario**:
  > *"Leé el archivo 'package.json' en la rama 'main' de 'MarcosLuna87-Dev/ProyectoM5_LunaMarcos' y creá un archivo 'DEPENDENCIES.md' listando todas las dependencias principales encontradas con un commit."*
* **Secuencia de tools ejecutadas por el agente**:
  1. Ejecuta `get_file_content` con `{ "owner": "MarcosLuna87-Dev", "repo": "ProyectoM5_LunaMarcos", "path": "package.json", "branch": "main" }`.
  2. Parsea el contenido JSON recibido.
  3. Ejecuta `create_file` enviando en `content` el archivo Markdown estructurado y `message: "docs: documentar dependencias del proyecto"`.
* **Resultado**: Documentación generada y versionada de forma automática sin salir del entorno de desarrollo.

---

## 13. Estructura del proyecto

A continuación se detalla la estructura física del repositorio y la responsabilidad de cada módulo:

```text
ProyectoM5_LunaMarcos/
├── .env                              # Variables de entorno locales con secretos (ignorado en Git)
├── .env.example                      # Plantilla de referencia para variables de entorno
├── .gitignore                        # Reglas de exclusión para Git (.env, node_modules/, dist/, coverage/)
├── package.json                      # Metadatos del proyecto, dependencias y scripts de npm
├── package-lock.json                 # Bloqueo determinista del árbol de dependencias
├── tsconfig.json                     # Configuración estricta del compilador TypeScript
├── vitest.config.ts                  # Configuración del motor de pruebas Vitest y cobertura V8
├── dist/                             # Código JavaScript compilado (generado por `npm run build`)
│   └── index.js                      # Punto de entrada compilado para producción
├── src/                              # Código fuente en TypeScript
│   ├── index.ts                      # Entry point: instancia transporte StdioServerTransport y conecta el servidor
│   ├── errors/                       # Jerarquía de errores tipados y normalización
│   │   └── errors.ts                 # AppError, ValidationError, GitHubAPIError, normalizeError y detección de red
│   ├── github/                       # Capa de integración con la API REST y Git Data API de GitHub
│   │   ├── client.ts                 # Instanciación de Octokit con hook de reintentos automáticos
│   │   ├── commit-files.ts           # Algoritmo de commit atómico (blobs, tree, commit y ref)
│   │   └── operations.ts             # Envoltura de llamadas a endpoints de Octokit
│   ├── schemas/                      # Esquemas de validación de entrada mediante Zod
│   │   ├── index.ts                  # Esquemas primitivos compartidos (owner, repo, path, branch, issue_number)
│   │   ├── add-comment-to-issue.schema.ts
│   │   ├── close-issue.schema.ts
│   │   ├── create-file.schema.ts
│   │   ├── create-issue.schema.ts
│   │   ├── create-label.schema.ts
│   │   ├── create-repository.schema.ts
│   │   ├── get-file-content.schema.ts
│   │   ├── list-issues.schema.ts
│   │   └── list-repositories.schema.ts
│   ├── tools/                        # Definición, metadata y handlers de las herramientas MCP
│   │   ├── index.ts                  # Función registerTools: registra las 9 tools en McpServer
│   │   ├── add-comment-to-issue.tool.ts
│   │   ├── close-issue.tool.ts
│   │   ├── create-file.tool.ts
│   │   ├── create-issue.tool.ts
│   │   ├── create-label.tool.ts
│   │   ├── create-repository.tool.ts
│   │   ├── get-file-content.tool.ts
│   │   ├── list-issues.tool.ts
│   │   └── list-repositories.tool.ts
│   └── utils/                        # Utilidades auxiliares y definiciones compartidas
│       ├── logger.ts                 # Logger seguro que sanitiza tokens y emite a stderr
│       ├── result.ts                 # Helpers ok() y fail() para estandarizar respuestas MCP
│       ├── retry.ts                  # Función withRetry con algoritmo de exponential backoff
│       ├── server.ts                 # createServer: fábrica que instancia McpServer y registra herramientas
│       └── types.ts                  # Interfaces de DTOs y tipos de retorno
└── tests/                            # Batería de pruebas automatizadas
    ├── integration/                  # Pruebas de integración sobre handlers simulando Octokit
    │   ├── create-file.test.ts
    │   ├── create-issue.test.ts
    │   ├── create-repository.test.ts
    │   ├── get-file-content.test.ts
    │   ├── list-issues.test.ts
    │   └── list-repositories.test.ts
    └── unit/                         # Pruebas unitarias sobre lógica pura
        ├── errors.test.ts            # Pruebas de normalización y clasificación de errores
        ├── retry.test.ts             # Pruebas de backoff exponencial y reintentos ante caídas
        └── schemas/                  # Pruebas unitarias sobre esquemas Zod
            ├── create-file.schema.test.ts
            ├── create-issue.schema.test.ts
            ├── create-repository.schema.test.ts
            ├── get-file-content.schema.test.ts
            ├── list-issues.schema.test.ts
            └── list-repositories.schema.test.ts
```

---

## 14. Testing

El proyecto utiliza **Vitest** como framework de pruebas, configurado en entorno Node.js con soporte nativo de TypeScript y mocks mediante `vi.mock()`.

### Comandos de ejecución

```bash
# Ejecutar todas las pruebas unitarias y de integración
npm test

# Ejecutar pruebas en modo observador interactivo (watch)
npm run test:watch

# Ejecutar pruebas y generar reporte de cobertura de código
npm run test:coverage

# Ejecutar un archivo de prueba específico
npx vitest tests/unit/errors.test.ts

# Ejecutar una suite específica filtrando por nombre
npx vitest tests/integration/create-issue.test.ts
```

### Alcance de las pruebas
* **Pruebas de esquemas (`tests/unit/schemas/`)**: Validan que los contratos de entrada rechacen datos inválidos (cadenas vacías, caracteres prohibidos en nombres de repositorios, números negativos en issues, colores hexadecimales mal formados o rutas con barra inicial `/`) sin llegar a invocar a GitHub.
* **Pruebas de errores y reintentos (`tests/unit/`)**: Verifican que la función `normalizeError` clasifique adecuadamente códigos de estado HTTP (401, 403, 404, 422, 429), errores de DNS o sockets (`ENOTFOUND`, `ECONNRESET`), y que `withRetry` aplique los retrasos progresivos correctos (500ms → 1000ms → 2000ms).
* **Pruebas de integración (`tests/integration/`)**: Verifican que cada handler de tool transforme correctamente los inputs válidos, interactúe con los métodos de Octokit simulados y devuelva la estructura de respuesta `{ ok: true, data }` o capture excepciones transformándolas en `{ ok: false, error }`.

---

## 15. Troubleshooting (Resolución de problemas frecuentes)

### 1. El MCP Server no aparece o no se conecta en Antigravity
* **Causa**: Ruta incorrecta al ejecutable, compilación no realizada o sintaxis inválida en `mcp_config.json`.
* **Solución**:
  1. Asegurate de haber ejecutado `npm run build` para que exista el archivo `dist/index.js`.
  2. Verificá que la ruta especificada en `args` dentro de `mcp_config.json` sea **absoluta** y que las barras invertidas en Windows estén duplicadas (`\\`).
  3. Comprobá que `node` esté accesible en el `PATH` o utilizá la ruta completa a `node.exe`.
  4. Reiniciá por completo Antigravity para forzar la recarga del archivo de configuración.

### 2. Error al iniciar el servidor: `Falta GITHUB_TOKEN`
* **Causa**: El proceso del servidor no encuentra la variable de entorno `GITHUB_TOKEN`.
* **Solución**:
  1. Verificá que exista el archivo `.env` en la raíz de `ProyectoM5_LunaMarcos` con la línea `GITHUB_TOKEN=ghp_...`.
  2. En la configuración de Antigravity (`mcp_config.json`), asegurate de incluir el bloque `"env": { "GITHUB_TOKEN": "ghp_..." }` para que la variable sea inyectada directamente al iniciar el subproceso.

### 3. Error `401 Unauthorized` (`AUTHENTICATION_ERROR`)
* **Mensaje del servidor**: `"Token invalido (401). Revisá GITHUB_TOKEN en el .env"`
* **Causa**: El token de GitHub es erróneo, fue revocado o venció su fecha de expiración.
* **Solución**: Ingresá en GitHub → Settings → Developer Settings → Personal access tokens, generá un nuevo token válido y actualizalo en `.env` y `mcp_config.json`.

### 4. Error `403 Forbidden` (`AUTHENTICATION_ERROR` o `Rate Limit`)
* **Mensaje del servidor**: `"Acceso denegado o rate limit (403)..."` o `"Ratelimit de GitHub (403/429)..."`
* **Causas**:
  * El token no cuenta con los permisos necesarios (por ejemplo, falta el scope `repo` o el permiso fine-grained `Contents: Read and write` para commitear archivos).
  * Se alcanzó el límite de llamadas a la API de GitHub (`x-ratelimit-remaining: 0`).
* **Solución**: Verificá los permisos del token en GitHub. Si se trata de un límite de tasa, el servidor reintentará automáticamente hasta 3 veces; si el límite continúa excedido, esperá a que finalice la ventana horaria de reseteo indicada por GitHub.

### 5. Error `404 Not Found` (`GITHUB_ERROR`)
* **Mensaje del servidor**: `"No se encontró el recurso (404). Revisá owner, repo, username o issue_number."`
* **Causas**:
  * El nombre del propietario (`owner`) o del repositorio (`repo`) está mal escrito.
  * El repositorio es privado y el token no tiene autorización para acceder a él.
  * Se intentó leer un archivo en una ruta (`path`) inexistente o en una rama que no existe.
* **Solución**: Comprobá en GitHub la existencia del recurso exacto y que el token tenga acceso al repositorio en cuestión.

### 6. Error `422 Unprocessable Entity` (`GITHUB_ERROR`)
* **Mensaje del servidor**: `"GitHub rechazó los datos (422). Revisá título/estado o si el repo tiene issues habilitados."`
* **Causas**: Datos sintácticamente válidos pero rechazados por las reglas de negocio de GitHub (ej. intentar crear un repositorio con un nombre ya existente en tu cuenta o abrir un issue en un repositorio que tiene la pestaña de Issues deshabilitada).
* **Solución**: Revisá la configuración del repositorio o cambiá el nombre del recurso a crear.

### 7. Error de validación Zod (`INPUT_INVALIDO`)
* **Mensaje del servidor**: `"El input no cumple con el contrato. No se hizo el llamado a GitHub"`
* **Causa**: Los parámetros provistos no satisfacen los requisitos del esquema (por ejemplo: enviar una ruta que inicia con `/`, un nombre de repositorio menor a 3 caracteres o un número de issue no entero).
* **Solución**: Inspeccioná la propiedad `details` en la respuesta de error; contendrá un desglose de los campos inválidos para ajustar el prompt adecuadamente.

### 8. Error `NOT_A_FILE` al leer contenido
* **Mensaje del servidor**: `"La ruta indicada no corresponde a un archivo de texto válido"`
* **Causa**: Se invocó `get_file_content` sobre un directorio o un archivo binario no admitido.
* **Solución**: Asegurate de apuntar a la ruta exacta de un archivo de texto (ej. `"src/index.ts"`).

---

## 16. Seguridad y buenas prácticas

* **Principio de mínimo privilegio**: Otorgá únicamente los permisos indispensables para la tarea a realizar. Si solo necesitás interactuar con un repositorio puntual, preferí tokens *Fine-grained* limitados a ese repositorio.
* **Aislamiento de credenciales**: El archivo `.env` se encuentra explícitamente ignorado en `.gitignore`. Nunca realices commits de archivos que contengan tokens, contraseñas o claves privadas.
* **Sanitización automática de logs**: El módulo de registro (`src/utils/logger.ts`) cuenta con la función `sanitize()`, la cual redacta automáticamente mediante expresiones regulares cualquier token con patrones `ghp_`, `github_pat_`, encabezados `Authorization: Bearer` y propiedades sensibles en objetos JSON antes de imprimirlos en consola.
* **Separación estricta de canales STDIO**: En servidores MCP, el canal `stdout` está reservado exclusivamente para los paquetes de datos JSON-RPC del protocolo. Todo log informativo, de advertencia o de error se emite estrictamente a través de `stderr` (`console.error`), garantizando que la sesión MCP no se corrompa con salidas de texto no estructuradas.
* **Expiración y rotación**: Configurá un período de caducidad razonable para tus tokens personales en GitHub y procedé a rotarlos periódicamente o revocarlos de inmediato si sospechás que fueron expuestos.

---

## 17. Licencia

Este proyecto se distribuye bajo los términos de la licencia **MIT** (o ISC según se indica en `package.json`). Podés utilizarlo, modificarlo y distribuirlo libremente para proyectos personales, académicos o comerciales.

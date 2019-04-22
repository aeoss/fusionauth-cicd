const { create } = require('axios')
const { safeLoadAll } = require('js-yaml')
const glob = require('glob-fs')
const { readFileSync } = require('fs')
const { basename, extname } = require('path')

require('dotenv')
  .config()

let yaml = ''
let currentStep = "Starting"
const Fusion = create({
  baseURL: process.env.FUSIONAUTH_URL,
  headers: {
    Authorization: process.env.FUSIONAUTH_TOKEN
  }
})

function gatherEnvToPointer() {
  yaml = yaml + '\r\nenv:'
  Object.keys(process.env).forEach((v) => {
    yaml = yaml + `\r\n E_${v.toUpperCase()}: &E_${v.toUpperCase()} "${process.env[v]}"`
  })
}

async function gatherSystemConfiguration() {
  currentStep = "Gather: System Configuration"

  const yamlGlob = glob({ gitignore: false })
  let templateFiles = yamlGlob.readdirSync('./data/**/**/*.yml')
  templateFiles = templateFiles.map((f) => readFileSync(f, 'UTF8'))

  if (process.env.DEBUG === true || process.env.DEBUG === "true") {
    console.log(yaml + "\n\n" + templateFiles.join(''))
  }

  return await safeLoadAll(yaml + "\n" + templateFiles.join(''))[0]
}

async function outputIfDebug(data) {
  if (process.env.DEBUG === true || process.env.DEBUG === "true") {
    console.log(JSON.stringify(data, null, 2));
    console.log()
  }

  return data
}

async function publishSystemConfiguration(cfg) {
  currentStep = "Publish: System Configuration"

  console.log('[ 2/2 ] Starting Publish of System Configuration')
  const r = await Fusion.put('/api/system-configuration', { systemConfiguration } = cfg)
  if (! r) {
    console.warn('Response not assigned to. Error?')
  }

  console.log('[ 2/2 ] System Configuration Published.')
  return null
}

async function publishEmailTemplate(template, method) {
  await Fusion[method](`/api/email/template/${template.id}`, {
    emailTemplate: {
      name: template.name,
      fromEmail: template.from.email,
      defaultFromName: template.from.name,
      defaultSubject: template.subject,
      defaultHtmlTemplate: template.templates.html,
      defaultTextTemplate: template.templates.text
    }
  })
}

async function publishEmailTemplates(cfg) {
  currentStep = "Publish: Email Templates"
  const existingEmails = (await Fusion.get('/api/email/template')).data.emailTemplates.map((r) => r.id)
  const { emails } = cfg.map

  console.log('[ 1/2 ] Starting Publish of Email Templates')

  emails.forEach(async (t) => {
    if (existingEmails.indexOf(t.id) > 0) {
      await publishEmailTemplate(t, 'put')

      return
    }

    await publishEmailTemplate(t, 'post')
  })

  console.log('[ 1/2 ] Email Templates Published.')

  return cfg
}

async function gatherEmailTemplates(cfg) {
  currentStep = 'Gather: Email Templates'

  if(!cfg || !cfg.map) {
    return cfg
  }

  const { emails } = cfg.map
  emails.forEach((em, key) => {
    const textGlob = glob({ gitignore: false })
    const htmlGlob = glob({ gitignore: false })

    const textFile = textGlob.readdirSync(`./data/**/${em.template}/*.text`)
    const htmlFile = htmlGlob.readdirSync(`./data/**/${em.template}/*.html`)

    const templates = {
      text: readFileSync(textFile[0], 'UTF8'),
      html: readFileSync(htmlFile[0], 'UTF8')
    }

    cfg.map.emails[key].templates = templates
  })

  return cfg
}

async function gatherUiTemplates(cfg) {
  currentStep = "Gather: UI Templates"

  const themeGlob = glob({ gitignore: false })
  const themeFiles = themeGlob.readdirSync('./data/**/*.(ftl|css)')

  if (! cfg.systemConfiguration.uiConfiguration) {
    cfg.systemConfiguration.uiConfiguration = {}
  }

  if (! cfg.systemConfiguration.uiConfiguration.loginTheme) {
    cfg.systemConfiguration.uiConfiguration.loginTheme = {}
  }

  if (themeFiles.length === 0) {
    return cfg
  }

  cfg.systemConfiguration.uiConfiguration.loginTheme.enabled = true

  const ftlFiles = themeFiles.filter((f) => extname(f) === '.ftl')
  const cssFiles = themeFiles.filter((f) => extname(f) === '.css')

  ftlFiles.forEach((f) => {
    const field = basename(f, '.ftl')

    cfg.systemConfiguration.uiConfiguration.loginTheme[field] = readFileSync(f, 'UTF8')
  })
  
  let stylesheet = ''
  cssFiles.forEach((f) => {
    stylesheet += readFileSync(f, 'UTF8')
  })

  cfg.systemConfiguration.uiConfiguration.loginTheme.stylesheet = stylesheet 

  return cfg
}

console.log()
console.log('[ 0/2 ] Starting Publish')

gatherEnvToPointer()
gatherSystemConfiguration()
  .then(outputIfDebug)
  .then(gatherEmailTemplates)
  .then(publishEmailTemplates)
  .then(gatherUiTemplates)
  .then(outputIfDebug)
  .then(publishSystemConfiguration)
  .then(() => {
    console.log('[ 2/2 ] Done. No errors captured.')
    
    process.exit(0)
  })
  .catch((e) => {
    console.error('Error [ Step -', currentStep, '] | Message:', e.message);
    
    if (e.response && e.response.data) {
      console.log();
      console.log('Error from FusionAuth:')
      console.log(JSON.stringify(e.response.data, null, 4));
    }

    process.exit(1)
  })

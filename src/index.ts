import { MessageBot, Player } from '@bhmb/bot'
import { UIExtensionExports } from '@bhmb/ui'

interface KeyedObject {
  [key: string]: any
}

interface Warns {
  [key: string]: number
}

function mergeByType<T extends KeyedObject>(target: T, extra: Partial<T>): T {
  Object.keys(extra).forEach(key => {
    if (typeof extra[key] == typeof target[key]) {
      target[key] = extra[key]
    }
  })
  return target
}

interface Settings {
  'threshold-ban': number
  'warn-kick': boolean
  'response-warn': string
  'response-warn-ban': string
  'response-warnlevel': string
  'response-set-warnings': string
  'response-unwarn': string
}

interface SettingsLabel extends HTMLLabelElement {
  dataset: {
    settingId: keyof Settings
  }
}

import commandsHtml from './commandsTab.html'
import settingsHtml from './settingsTab.html'
import logHtml from './logTab.html'

const warningsKey = 'warns'
const logKey = 'log'
const settingsKey = 'settings'
const commands = ['warn', 'unwarn', 'warnlevel', 'set-warnings']

MessageBot.registerExtension('bibliofile/warnings', (ex, world) => {
  const getWarnings = () => ex.storage.get<Warns>(warningsKey, {})
  const getLog = () => ex.storage.get<string[]>(logKey, [])
  const getSettings = () => mergeByType<Settings>({
    'threshold-ban': 5,
    'warn-kick': true,
    'response-warn': '{{Name}}, you have been warned for breaking the rules. Please behave yourself. If warned {{left}} more time(s) you will be banned.',
    'response-warn-ban': '{{Name}} has been banned after multiple warnings.',
    'response-warnlevel': 'Warnings for {{Name}}: {{amount}}',
    'response-set-warnings': '{{Name}} set {{Target}}\'s warnings to {{amount}}.',
    'response-unwarn': 'Warning removed from {{Name}}, {{Name}} now has {{left}} warnings.'
  }, ex.storage.get<Partial<Settings>>(settingsKey, {}))

  // Allow overrides
  let logMessage = (message: string) => ex.storage.set('log', getLog().concat([message]))

  const canWarn = (player: Player) => !player.isStaff
  const getWarns = (player: Player) => getWarnings()[player.name] || 0

  world.addCommand('warn', (player, args) => {
    let target = world.getPlayer(args)
    if (!canWarn(target) || !player.isStaff) return

    let settings = getSettings()
    logMessage(`${player.name} warned ${args}`)

    ex.storage.with<Warns>(warningsKey, {}, warnings => {
      warnings[target.name] = (warnings[target.name] || 0) + 1
    })
    let warnings = getWarns(target)

    // What message to send?
    if (warnings > settings['threshold-ban']) {
      ex.bot.send(settings['response-warn-ban'], { name: target.name })
      ex.bot.send(`/ban ${target.name}`)
      logMessage(`Banning ${target.name}. Exceeded ban threshold`)
    } else {
      ex.bot.send(settings['response-warn'], {
        left: (settings['threshold-ban'] - warnings).toString(),
        name: target.name
      })

      if (settings['warn-kick']) ex.bot.send(`/kick ${target.name}`)
    }
  })

  world.addCommand('unwarn', (player, args) => {
    let target = world.getPlayer(args)
    if (!canWarn(target) || !player.isStaff) return

    logMessage(`${player.name} unwarned ${target.name}`)
    ex.storage.with<Warns>(warningsKey, {}, warns => {
      warns[target.name] = warns[target.name] > 0 ? warns[target.name] - 1 : 0
    })

    ex.bot.send(getSettings()['response-unwarn'], {
      left: getWarns(target) + '',
      name: target.name
    })
  })

  world.addCommand('warnlevel', (player, args) => {
    let name = player.name
    if (args && player.isStaff) name = args

    ex.bot.send(getSettings()['response-warnlevel'], {
      name,
      amount: getWarns(world.getPlayer(name)) + ''
    })
  })

  world.addCommand('set-warnings', (player, args) => {
    if (!player.isAdmin) return

    let amount = +args.substring(0, args.indexOf(' '))
    if (Number.isNaN(amount)) return

    let target = world.getPlayer(args.substring(args.indexOf(' ') + 1))
    if (!canWarn(target)) return

    ex.storage.with<Warns>(warningsKey, {}, warns => {
      warns[target.name] = amount
    })

    let settings = getSettings()
    ex.bot.send(settings['response-set-warnings'], {
      Target: target.name[0] + target.name.slice(1).toLocaleLowerCase(),
      TARGET: target.name,
      target: target.name.toLocaleLowerCase(),
      amount: '' + amount,
      name: player.name
    })
    logMessage(`${player.name} set ${target.name}'s warnings to ${amount}`)

    if (getWarns(target) > settings['threshold-ban']) {
      ex.bot.send(settings['response-warn-ban'], { name: target.name })
      ex.bot.send(`/ban ${target.name}`)
      logMessage(`Banning ${target.name}. Exceeded ban threshold`)
    }
  })

  ex.remove = () => commands.forEach(command => world.removeCommand(command))

  // Browser only
  const ui = ex.bot.getExports('ui') as UIExtensionExports | undefined
  if (!ui) return

  // Create tabs
  ui.addTabGroup('Warnings', 'warnings')
  let commandsTab = ui.addTab('Commands', 'warnings')
  commandsTab.innerHTML = commandsHtml
  let settingsTab = ui.addTab('Settings', 'warnings')
  settingsTab.innerHTML = settingsHtml
  let logTab = ui.addTab('Log', 'warnings')
  logTab.innerHTML = logHtml

  // Init settings
  settingsTab.querySelectorAll('label').forEach((label: SettingsLabel) => {
    // Just work... not sure how to type this.
    let input = label.querySelector('input') as any
    let settings = getSettings()

    switch (input.type) {
      case 'checkbox':
        input.checked = settings[label.dataset.settingId] || false
        break
      case 'number':
        input.value = settings[label.dataset.settingId] || 0
        break
      default:
        input.value = settings[label.dataset.settingId] || ''
    }
  })

  // Save on change
  settingsTab.addEventListener('change', function () {
    var settings: Partial<Settings> = {}
    settingsTab.querySelectorAll('label').forEach((label: SettingsLabel) => {
      var input = label.querySelector('input') as any
      switch (input.type) {
        case 'checkbox':
          settings[label.dataset.settingId] = input.checked
          break
        case 'number':
          settings[label.dataset.settingId] = +input.value
          break
        default:
          settings[label.dataset.settingId] = input.value
      }
    })
    ex.storage.set('settings', settings)
  })

  // Init log
  getLog().forEach(function (line) {
    var el = document.createElement('li')
    el.textContent = line
    ;(logTab.querySelector('ul') as HTMLElement).appendChild(el)
  })

  logMessage = (function (orig) {
    return (message: string) => {
      orig(message)
      let el = document.createElement('li')
      el.textContent = message
      ;(logTab.querySelector('ul') as HTMLElement).appendChild(el)
    }
  })(logMessage)

  ;(logTab.querySelector('a') as HTMLElement).addEventListener('click', () => {
    ui.alert('Are you sure you want to clear the logs? This cannot be undone.', [
      { text: 'Yes', style: 'is-danger' },
      { text: 'Cancel' }
    ], response => {
      if (response == 'Yes') {
        ex.storage.set('log', [])
        ;(logTab.querySelector('ul') as HTMLElement).innerHTML = ''
      }
    })
  })

  ex.remove = (function(orig) {
    return () => {
      orig()
      ui.removeTabGroup('warnings')
    }
  })(ex.remove)
})

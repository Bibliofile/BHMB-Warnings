(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(require('@bhmb/bot')) :
	typeof define === 'function' && define.amd ? define(['@bhmb/bot'], factory) :
	(factory(global['@bhmb/bot']));
}(this, (function (bot) { 'use strict';

var commandsHtml = "<div class=\"container is-fluid\">\n  <p>Once a player reaches a specified number of warnings, they will automatically be banned. Staff cannot be warned.</p>\n  <h3 class=\"title\">Commands Added</h3>\n  <ul>\n    <li>/WARNLEVEL - Lets a player check how many warnings they have.</li>\n    <li>/WARN &lt;NAME&gt; - (staff only) Adds a warning to NAME and takes any actions specified at that warning level.</li>\n    <li>/UNWARN &lt;NAME&gt; - (staff only) Removes a warning from NAME. If NAME is banned, they will not be unbanned.</li>\n    <li>/WARNLEVEL &lt;NAME&gt; - (staff only) Checks how many warnings NAME has.</li>\n    <li>/SET-WARNINGS &lt;NUMBER&gt; &lt;NAME&gt; - (admin only) Sets NAME&apos;s warnings to NUMBER.</li>\n  </ul>\n</div>\n";

var settingsHtml = "<div class=\"container is-fluid\">\n  <h3 class=\"title\">General</h3>\n  <label data-setting-id=\"warn-kick\">\n    Kick user when warned:\n    <input class=\"checkbox\" type=\"checkbox\">\n  </label>\n  <br>\n  <label data-setting-id=\"threshold-ban\">\n    Warnings before ban:\n    <input class=\"input\" type=\"number\" min=\"1\">\n  </label>\n  <h3 class=\"title\">Responses</h3>\n  <label data-setting-id=\"response-warnlevel\">\n    /WARNLEVEL\n    <input class=\"input\">\n  </label>\n  <label data-setting-id=\"response-warn\">\n    /WARN - With warnings left\n    <input class=\"input\">\n  </label>\n  <label data-setting-id=\"response-warn-ban\">\n    /WARN - When banned\n    <input class=\"input\">\n  </label>\n  <label data-setting-id=\"response-set-warnings\">\n    /SET-WARNINGS\n    <input class=\"input\">\n  </label>\n  <label data-setting-id=\"response-unwarn\">\n    /UNWARN\n    <input class=\"input\">\n  </label>\n</div>";

var logHtml = "<div class=\"container is-fluid\">\n  <p>Commands used will be shown here.\n    <a>Clear Log</a>\n  </p>\n  <ul style=\"list-style-type:none;\"></ul>\n</div>";

function mergeByType(target, extra) {
    Object.keys(extra).forEach(key => {
        if (typeof extra[key] == typeof target[key]) {
            target[key] = extra[key];
        }
    });
    return target;
}
const warningsKey = 'warns';
const logKey = 'log';
const settingsKey = 'settings';
const commands = ['warn', 'unwarn', 'warnlevel', 'set-warnings'];
bot.MessageBot.registerExtension('bibliofile/warnings', (ex, world) => {
    const getWarnings = () => ex.storage.get(warningsKey, {});
    const getLog = () => ex.storage.get(logKey, []);
    const getSettings = () => mergeByType({
        'threshold-ban': 5,
        'warn-kick': true,
        'response-warn': '{{Name}}, you have been warned for breaking the rules. Please behave yourself. If warned {{left}} more time(s) you will be banned.',
        'response-warn-ban': '{{Name}} has been banned after multiple warnings.',
        'response-warnlevel': 'Warnings for {{Name}}: {{amount}}',
        'response-set-warnings': '{{Name}} set {{Target}}\'s warnings to {{amount}}.',
        'response-unwarn': 'Warning removed from {{Name}}, {{Name}} now has {{left}} warnings.'
    }, ex.storage.get(settingsKey, {}));
    // Allow overrides
    let logMessage = (message) => ex.storage.set('log', getLog().concat([message]));
    const canWarn = (player) => !player.isStaff;
    const getWarns = (player) => getWarnings()[player.name] || 0;
    world.addCommand('warn', (player, args) => {
        let target = world.getPlayer(args);
        if (!canWarn(target) || !player.isStaff)
            return;
        let settings = getSettings();
        logMessage(`${player.name} warned ${args}`);
        ex.storage.with(warningsKey, {}, warnings => {
            warnings[target.name] = (warnings[target.name] || 0) + 1;
        });
        let warnings = getWarns(target);
        // What message to send?
        if (warnings > settings['threshold-ban']) {
            ex.bot.send(settings['response-warn-ban'], { name: target.name });
            ex.bot.send(`/ban ${target.name}`);
            logMessage(`Banning ${target.name}. Exceeded ban threshold`);
        }
        else {
            ex.bot.send(settings['response-warn'], {
                left: (settings['threshold-ban'] - warnings).toString(),
                name: target.name
            });
            if (settings['warn-kick'])
                ex.bot.send(`/kick ${target.name}`);
        }
    });
    world.addCommand('unwarn', (player, args) => {
        let target = world.getPlayer(args);
        if (!canWarn(target) || !player.isStaff)
            return;
        logMessage(`${player.name} unwarned ${target.name}`);
        ex.storage.with(warningsKey, {}, warns => {
            warns[target.name] = warns[target.name] > 0 ? warns[target.name] - 1 : 0;
        });
        ex.bot.send(getSettings()['response-unwarn'], {
            left: getWarns(target) + '',
            name: target.name
        });
    });
    world.addCommand('warnlevel', (player, args) => {
        let name = player.name;
        if (args && player.isStaff)
            name = args;
        ex.bot.send(getSettings()['response-warnlevel'], {
            name,
            amount: getWarns(world.getPlayer(name)) + ''
        });
    });
    world.addCommand('set-warnings', (player, args) => {
        if (!player.isAdmin)
            return;
        let amount = +args.substring(0, args.indexOf(' '));
        if (Number.isNaN(amount))
            return;
        let target = world.getPlayer(args.substring(args.indexOf(' ') + 1));
        if (!canWarn(target))
            return;
        ex.storage.with(warningsKey, {}, warns => {
            warns[target.name] = amount;
        });
        let settings = getSettings();
        ex.bot.send(settings['response-set-warnings'], {
            Target: target.name[0] + target.name.slice(1).toLocaleLowerCase(),
            TARGET: target.name,
            target: target.name.toLocaleLowerCase(),
            amount: '' + amount,
            name: player.name
        });
        logMessage(`${player.name} set ${target.name}'s warnings to ${amount}`);
        if (getWarns(target) > settings['threshold-ban']) {
            ex.bot.send(settings['response-warn-ban'], { name: target.name });
            ex.bot.send(`/ban ${target.name}`);
            logMessage(`Banning ${target.name}. Exceeded ban threshold`);
        }
    });
    ex.remove = () => commands.forEach(command => world.removeCommand(command));
    // Browser only
    const ui = ex.bot.getExports('ui');
    if (!ui)
        return;
    // Create tabs
    ui.addTabGroup('Warnings', 'warnings');
    let commandsTab = ui.addTab('Commands', 'warnings');
    commandsTab.innerHTML = commandsHtml;
    let settingsTab = ui.addTab('Settings', 'warnings');
    settingsTab.innerHTML = settingsHtml;
    let logTab = ui.addTab('Log', 'warnings');
    logTab.innerHTML = logHtml;
    // Init settings
    settingsTab.querySelectorAll('label').forEach((label) => {
        // Just work... not sure how to type this.
        let input = label.querySelector('input');
        let settings = getSettings();
        switch (input.type) {
            case 'checkbox':
                input.checked = settings[label.dataset.settingId] || false;
                break;
            case 'number':
                input.value = settings[label.dataset.settingId] || 0;
                break;
            default:
                input.value = settings[label.dataset.settingId] || '';
        }
    });
    // Save on change
    settingsTab.addEventListener('change', function () {
        var settings = {};
        settingsTab.querySelectorAll('label').forEach((label) => {
            var input = label.querySelector('input');
            switch (input.type) {
                case 'checkbox':
                    settings[label.dataset.settingId] = input.checked;
                    break;
                case 'number':
                    settings[label.dataset.settingId] = +input.value;
                    break;
                default:
                    settings[label.dataset.settingId] = input.value;
            }
        });
        ex.storage.set('settings', settings);
    });
    // Init log
    getLog().forEach(function (line) {
        var el = document.createElement('li');
        el.textContent = line;
        logTab.querySelector('ul').appendChild(el);
    });
    logMessage = (function (orig) {
        return (message) => {
            orig(message);
            let el = document.createElement('li');
            el.textContent = message;
            logTab.querySelector('ul').appendChild(el);
        };
    })(logMessage);
    logTab.querySelector('a').addEventListener('click', () => {
        ui.alert('Are you sure you want to clear the logs? This cannot be undone.', [
            { text: 'Yes', style: 'is-danger' },
            { text: 'Cancel' }
        ], response => {
            if (response == 'Yes') {
                ex.storage.set('log', []);
                logTab.querySelector('ul').innerHTML = '';
            }
        });
    });
    ex.remove = (function (orig) {
        return () => {
            orig();
            ui.removeTabGroup('warnings');
        };
    })(ex.remove);
});

})));
//# sourceMappingURL=bundle.js.map

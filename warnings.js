/*jshint
    esversion: 6,
    unused: strict,
    undef: true,
    browser: true,
    devel: true
*/
/*globals
    MessageBot
*/

MessageBot.registerExtension('bibliofile/warnings2', function(ex, world) {
    function getWarnings() {
        return world.storage.getObject('warnings_warns', {});
    }
    function getLog() {
        return world.storage.getObject('warnings_log', []);
    }
    function getSettings() {
        var setting_defaults = {
            'threshold-ban': 5,
            'warn-kick': true,
            'response-warn': '{{Name}}, you have been warned for breaking the rules. Please behave yourself. If warned {{left}} more time(s) you will be banned.',
            'response-warn-ban': '{{Name}} has been banned after multiple warnings.',
            'response-warnlevel': 'Warnings for {{Name}}: {{amount}}',
            'response-set-warnings': '{{Name}} set {{Target}}\'s warnings to {{amount}}.',
            'response-unwarn': 'Warning removed from {{Name}}, {{Name}} now has {{left}} warnings.'
        };
        var settings = world.storage.getObject('warnings_settings', {});
        Object.keys(setting_defaults).forEach(function(key) {
            if (typeof settings[key] != typeof setting_defaults[key]) {
                settings[key] = setting_defaults[key];
            }
        });

        return settings;
    }

    var logMessage = function(message) {
        world.storage.set('warnings_log', getLog().concat([message]));
    };

    var warningHelper = {
        getWarns: function(name) {
            return getWarnings()[name.toLocaleUpperCase()] || 0;
        },
        canWarn: function(name) {
            return !world.getPlayer(name).isStaff();
        },
        addWarning: function(name) {
            name = name.toLocaleUpperCase();
            var warnings = getWarnings();
            if (warnings[name]) {
                warnings[name]++;
            } else {
                warnings[name] = 1;
            }
            world.storage.set('warnings_warns', warnings);
        },
        removeWarning: function(name) {
            name = name.toLocaleUpperCase();
            var warnings = getWarnings();
            if (warnings[name] && warnings[name] > 0) {
                warnings[name]--;
                if (warnings[name] === 0) delete warnings[name];
                world.storage.set('warnings_warns', warnings);
            }
        },
        setWarnings: function(name, number) {
            name = name.toLocaleUpperCase();
            var warnings = getWarnings();
            warnings[name] = number;
            if (warnings[name] === 0) delete warnings[name];
            world.storage.set('warnings_warns', warnings);
        },
    };


    world.addCommand('warn', function(player, args) {
        if (!warningHelper.canWarn(args) || !player.isStaff()) {
            return;
        }

        var settings = getSettings();

        logMessage(player.getName() + ' warned ' + args);

        warningHelper.addWarning(args);
        if (warningHelper.getWarns(args) > settings['threshold-ban']) {
            ex.bot.send(settings['response-warn-ban'], { name: args });
            ex.bot.send('/ban ' + args);
            logMessage('Banning ' + args + '. Exceeded ban threshold');
            return;
        }

        ex.bot.send(settings['response-warn'], {
            left: settings['threshold-ban'] - warningHelper.getWarns(args),
            name: args
        });

        if (settings['warn-kick']) {
            ex.bot.send('/kick ' + args);
        }
    });

    world.addCommand('unwarn', function(player, args) {
        if (!warningHelper.canWarn(args) || !player.isStaff()) {
            return;
        }

        logMessage(player.getName() + ' unwarned ' + args);
        warningHelper.removeWarning(args);

        ex.bot.send(getSettings()['response-unwarn'], {left: warningHelper.getWarns(args), name: args});
    });

    world.addCommand('warnlevel', function(player, args) {
        var name = player.getName();
        if (args && player.isStaff()) name = args;

        ex.bot.send(getSettings()['response-warnlevel'], {
            name: name,
            amount: warningHelper.getWarns(name)
        });
    });

    world.addCommand('set-warnings', function(player, args) {
        if (!player.isAdmin()) return;
        args = args.toLocaleUpperCase();

        var amount = +args.substring(0, args.indexOf(' '));
        if (isNaN(amount)) return;

        var target = args.substring(args.indexOf(' ') + 1);
        if (!warningHelper.canWarn(target)) return;

        warningHelper.setWarnings(target, amount);

        var settings = getSettings();

        ex.bot.send(settings['response-set-warnings'], {
            Target: target[0] + target.substr(1).toLocaleLowerCase(),
            TARGET: target,
            target: target.toLocaleLowerCase(),
            amount: amount,
            name: player.getName()
        });
        logMessage(player.getName() + ' set ' + target + '\'s warnings to ' + amount);

        if (warningHelper.getWarns(target) > settings['threshold-ban']) {
            ex.bot.send(settings['response-warn-ban'], {name: target});
            ex.bot.send('/ban ' + target);
            logMessage('Banning ' + target + '. Exceeded ban threshold');
        }
    });

    ex.uninstall = function() {
        ['warn', 'unwarn', 'warnlevel', 'set-warnings'].forEach(function(command) {
            world.removeCommand(command);
        });
        world.storage.clearNamespace('warnings_');
    };

    // Browser only
    if (ex.isNode) return;


    var ui = ex.bot.getExports('ui');
    ui.addTabGroup('Warnings', 'warnings');

    var commandsTab = ui.addTab('Commands', 'warnings');
    commandsTab.innerHTML = '<div class="container is-fluid"><p>Once a player reaches a specified number of warnings, they will automatically be banned. Staff cannot be warned.<h3 class=title>Commands Added</h3><ul><li>/WARNLEVEL - Lets a player check how many warnings they have.<li>/WARN &lt;NAME&gt; - (staff only) Adds a warning to NAME and takes any actions specified at that warning level.<li>/UNWARN &lt;NAME&gt; - (staff only) Removes a warning from NAME. If NAME is banned, they will not be unbanned.<li>/WARNLEVEL &lt;NAME&gt; - (staff only) Checks how many warnings NAME has.<li>/SET-WARNINGS &lt;NUMBER&gt; &lt;NAME&gt; - (admin only) Sets NAME&apos;s warnings to NUMBER.</ul></div>';

    var settingsTab = ui.addTab('Settings', 'warnings');
    settingsTab.innerHTML = '<div class="container is-fluid"><h3 class=title>General</h3><label data-setting-id=warn-kick>Kick user when warned: <input class=checkbox type=checkbox></label><br><label data-setting-id=threshold-ban>Warnings before ban: <input class=input type=number min=1></label><h3 class=title>Responses</h3><label data-setting-id=response-warnlevel>/WARNLEVEL <input class=input></label><label data-setting-id=response-warn>/WARN - With warnings left <input class=input></label><label data-setting-id=response-warn-ban>/WARN - When banned <input class=input></label><label data-setting-id=response-set-warnings>/SET-WARNINGS <input class=input></label><label data-setting-id=response-unwarn>/UNWARN <input class=input></label></div>';
    // Initialize
    Array.from(settingsTab.querySelectorAll('label')).forEach(function(label) {
        var input = label.querySelector('input');
        var settings = getSettings();

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
    settingsTab.addEventListener('change', function() {
        var settings = {};
        Array.from(settingsTab.querySelectorAll('label')).forEach(function(label) {
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
        world.storage.set('warnings_settings', settings);
    });


    var logTab = ui.addTab('Log', 'warnings');
    logTab.innerHTML = '<div class="container is-fluid"><p>Commands used will be shown here. <a>Clear Log</a><ul style=list-style-type:none></ul></div>';
    getLog().forEach(function(line) {
        var el = document.createElement('li');
        el.textContent = line;
        logTab.querySelector('ul').appendChild(el);
    });

    // Override the logMessage function to also write to the page.
    logMessage = (function(orig) {
        return function(message) {
            orig(message);
            var el = document.createElement('li');
            el.textContent = message;
            logTab.querySelector('ul').appendChild(el);
        };
    }(logMessage));

    // Clearing logs
    logTab.querySelector('a').addEventListener('click', function() {
        ui.alert('Are you sure you want to clear the logs? This cannot be undone.', [
            { text: 'Yes', style: 'is-danger' },
            { text: 'Cancel'}
        ], function(response) {
            if (response == 'Yes') {
                world.storage.set('warnings_log', []);
                logTab.querySelector('ul').innerHTML = '';
            }
        });
    });


    ex.uninstall = (function(orig) {
        return function() {
            orig();
            ui.removeTabGroup('warnings');
        };
    }(ex.uninstall));
});

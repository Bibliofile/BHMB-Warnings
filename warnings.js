/*jshint
    esversion: 6,
    unused: strict,
    undef: true,
    browser: true,
    devel: true
*/
/*globals
    MessageBotExtension
*/

var warnings = MessageBotExtension('warnings');

(function(ex, ui) {
    'use strict';

    ex.setAutoLaunch(true);
    ex.uninstall = function() {
        ui.removeTab(ex.tab);
        ex.storage.removeNamespace('warnings_log');
        ex.storage.removeNamespace('warnings_warns');
        ex.storage.removeNamespace('warnings_settings');
        ex.hook.remove('world.command', warnListener);
    };

    ex.tab = ui.addTab('Warnings');
    ex.tab.innerHTML = '<style>#warnings_tab > div{display: none; background: #E7E7E7; padding: 5px;}#warnings_tab > div.visible{display: block;}#warnings_tab > nav{width: 100%; display: -webkit-box; display: -ms-flexbox; display: flex; -ms-flex-flow: row wrap; flex-flow: row wrap;}#warnings_tab > nav span{background: #182B73; color: #fff; height: 40px; display: -webkit-box; display: -ms-flexbox; display: flex; -webkit-box-align: center; -ms-flex-align: center; align-items: center; -webkit-box-pack: center; -ms-flex-pack: center; justify-content: center; -webkit-box-flex: 1; -ms-flex-positive: 1; flex-grow: 1; margin-top: 5px; margin-right: 5px; min-width: 120px;}#warnings_tab > nav span.selected{background: #E7E7E7; color: #000;}</style><div id="warnings_tab"> <nav> <span data-tab-name="info" class="selected">Info</span> <span data-tab-name="settings">Settings</span> <span data-tab-name="log">Log</span> </nav> <div data-tab-name="info" class="visible"> <p>Once a player reaches a specified number of warnings, they will automatically be banned. Staff cannot be warned.</p><h3 class="title">Commands Added</h3> <ul> <li>/WARNLEVEL - Lets a player check how many warnings they have.</li><li>/WARN &lt;NAME&gt; - (staff only) Adds a warning to NAME and takes any actions specified at that warning level.</li><li>/UNWARN &lt;NAME&gt; - (staff only) Removes a warning from NAME. If NAME is banned, they will not be unbanned.</li><li>/WARNLEVEL &lt;NAME&gt; - (staff only) Checks how many warnings NAME has.</li><li>/SET-WARNINGS &lt;NUMBER&gt; &lt;NAME&gt; - (admin only) Sets NAME&apos;s warnings to NUMBER.</li></ul> </div><div data-tab-name="settings"> <h3 class="title">General</h3> <label data-setting-id="warn-kick"> Kick user when warned: <input class="checkbox" type="checkbox"> </label><br><label data-setting-id="threshold-ban"> Warnings before ban: <input class="input" type="number" min="1"> </label> <h3 class="title">Responses</h3> <label data-setting-id="response-warnlevel"> /WARNLEVEL <input class="input"> </label> <label data-setting-id="response-warn"> /WARN - With warnings left <input class="input"> </label> <label data-setting-id="response-warn-ban"> /WARN - When banned <input class="input"> </label> <label data-setting-id="response-set-warnings"> /SET-WARNINGS <input class="input"> </label> <label data-setting-id="response-unwarn"> /UNWARN <input class="input"> </label> </div><div data-tab-name="log"> <p>Commands used will be shown here. <a>Clear Log</a></p><ul style="list-style-type:none;"></ul> </div></div>';

    var warnings = ex.storage.getObject('warnings_warns', {});
    var log = ex.storage.getObject('warnings_log', []);
    log.forEach(logMessage);
    var settings = ex.storage.getObject('warnings_settings', {});
    var setting_defaults = {
        'threshold-ban': 5,
        'warn-kick': true,
        'response-warn': '{{Name}}, you have been warned for breaking the rules. Please behave yourself. If warned {{left}} more time(s) you will be banned.',
        'response-warn-ban': '{{Name}} has been banned after multiple warnings.',
        'response-warnlevel': 'Warnings for {{Name}}: {{amount}}',
        'response-set-warnings': '{{Name}} set {{Target}}\'s warnings to {{amount}}.',
        'response-unwarn': 'Warning removed from {{Name}}, {{Name}} now has {{left}} warnings.'
    };
    Object.keys(setting_defaults).forEach(function(key) {
        if (typeof settings[key] != typeof setting_defaults[key]) {
            settings[key] = setting_defaults[key];
        }
    });

    var warningHelper = {
        getWarns: function(name) {
            return warnings[name.toLocaleUpperCase()] || 0;
        },
        canWarn: function(name) {
            return !!ex.bot.world.players[name.toLocaleUpperCase()] && !ex.bot.world.lists.staff.includes(name.toLocaleUpperCase());
        },
        addWarning: function(name) {
            if (warnings[name]) {
                warnings[name]++;
            } else {
                warnings[name] = 1;
            }
            save();
        },
        removeWarning: function(name) {
            if (warnings[name] && warnings[name] > 0) {
                warnings[name]--;
            }
        },
        setWarnings: function(name, number) {
            warnings[name.toLocaleUpperCase()] = number;
            save();
        },
    };

    ex.tab.querySelector('nav').addEventListener('click', function(event) {
        var tabName = event.target.dataset.tabName;
        if (tabName) {
            //Tab nav
            ex.tab.querySelector('.selected').classList.remove('selected');
            event.target.classList.add('selected');
            //Tab content
            ex.tab.querySelector('.visible').classList.remove('visible');
            ex.tab.querySelector('div[data-tab-name="' + tabName + '"]').classList.add('visible');
        }
    });
    ex.tab.addEventListener('change', save);
    ex.tab.querySelector('a').addEventListener('click', function() {
        ui.alert('Are you sure you want to clear the logs?', [
            {text: 'Yes', action: function() {
                log = [];
                ex.tab.querySelector('[data-tab-name="log"] ul').innerHTML = '';
                save();
            }},
            {text: 'Cancel'}
        ]);
    });


    var containers = document.querySelectorAll('#warnings_tab > div[data-tab-name="settings"] label');
    Array.from(containers).forEach(function(label) {
        var input = label.querySelector('input');
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


    function save() {
        settings = {};
        containers.forEach(function(label) {
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

        var els = ex.tab.querySelector('[data-tab-name="log"] ul').children;
        log = [];
        Array.from(els).forEach(function(el) {
            log.push(el.textContent);
        });

        ex.storage.set('warnings_settings', settings);
        ex.storage.set('warnings_log', log);
        ex.storage.set('warnings_warns', warnings);
    }

    function logMessage(message) {
        var el = document.createElement('li');
        el.textContent = message;
        ex.tab.querySelector('[data-tab-name="log"] ul').appendChild(el);
    }

    function sendHelper(message, replace, name) {
        var m = message;
        Object.keys(replace).forEach(function(key) {
            m = m.replace(new RegExp('{{' + key + '}}', 'g'), replace[key]);
        });

        if (name) {
            m = m.replace(/{{Name}}/g, name[0] + name.substr(1).toLocaleLowerCase())
                .replace(/{{NAME}}/g, name)
                .replace(/{{name}}/g, name.toLocaleLowerCase());
        }

        ex.bot.send(m);
    }

    ex.hook.listen('world.command', warnListener);
    function warnListener(name, command, args) {
        command = command.toLocaleLowerCase();
        args = args.toLocaleUpperCase();

        if (command == 'warnlevel' && !args) {
            sendHelper(settings['response-warnlevel'], {
                amount: warningHelper.getWarns(name)
            }, name);
            return;
        }

        if (!ex.world.isStaff(name)) {
            return;
        }

        if (command == 'warnlevel') {

            sendHelper(settings['response-warnlevel'], {
                amount: warningHelper.getWarns(args),
            }, args);

        } else if (command == 'unwarn') {
            if (!warningHelper.canWarn(args)) {
                return;
            }

            logMessage(name + ' unwarned ' + args);
            warningHelper.removeWarning(args);

            sendHelper(settings['response-unwarn'], {left: warningHelper.getWarns(args)}, args);

        } else if (command == 'warn') {

            if (!warningHelper.canWarn(args)) {
                return;
            }

            logMessage(name + ' warned ' + args);

            warningHelper.addWarning(args);
            if (warningHelper.getWarns(args) > settings['threshold-ban']) {
                sendHelper(settings['response-warn-ban'], {}, args);
                ex.bot.send('/ban ' + args);
                logMessage('Banning ' + args + '. Exceeded ban threshold');
                return;
            }

            sendHelper(settings['response-warn'], {
                left: settings['threshold-ban'] - warningHelper.getWarns(args),
            }, args);

            if (settings['warn-kick']) {
                ex.bot.send('/kick ' + args);
            }

        } else if (command == 'set-warnings') {

            if (!ex.world.isAdmin(name)) {
                return;
            }
            var amount = +args.substring(0, args.indexOf(' '));
            if (isNaN(amount)) {
                return;
            }
            var target = args.substring(args.indexOf(' ') + 1);

            if (!warningHelper.canWarn(target)) {
                return;
            }

            warningHelper.setWarnings(target, amount);

            sendHelper(settings['response-set-warnings'], {
                Target: target[0] + target.substr(1).toLocaleLowerCase(),
                TARGET: target,
                target: target.toLocaleLowerCase(),
                amount: amount,
            }, name);
            logMessage(name + ' set ' + target + '\'s warnings to ' + amount);

            if (warningHelper.getWarns(target) > settings['threshold-ban']) {
                sendHelper(settings['response-warn-ban'], {}, target);
                ex.bot.send('/ban ' + target);
                logMessage('Banning ' + target + '. Exceeded ban threshold');
                return;
            }

        }
    }
}(warnings, warnings.ui));

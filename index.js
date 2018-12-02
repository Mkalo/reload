const fs = require("fs");
const path = require("path");

module.exports = function Reload(dispatch) {
    const command = dispatch.command || dispatch.require.command;

    const statePackets = ["S_LOGIN"];
    const lastStates = {};

    for (let packet of statePackets) {
        dispatch.hook(packet, "raw", (code, data) => {
            lastStates[code] = Buffer.from(data);
        });
    }

    function unloadCachedFiles(source) {
        if (fs.lstatSync(source).isDirectory()) {
            for (const file of fs.readdirSync(source)) {
                unloadCachedFiles(path.join(source, file));
            }
        } else {
            try {
                delete require.cache[require.resolve(source)];
            } catch (e) {}
        }
    }

    function loadModule(name) {
        const command_add = command.base.add;

        command.base.add = (cmd, ...args) => {
            try {
                command_add.call(command.base, cmd, ...args);
            } catch(e) {
                // Probably added a command that already exist, lets remove it and add it again
                command.base.remove(cmd);
                command_add.call(command.base, cmd, ...args);
            }
        }

        dispatch.load(name, module);

        command.base.add = command_add;

        if (dispatch.base.isLoaded(name)) {
            for (let [code, data] of Object.entries(lastStates)) {
                code = parseInt(code);
                if (dispatch.base.hooks.has(code)) {
                    for (let orderings of dispatch.base.hooks.get(code)) {
                        for (let hook of orderings.hooks) {
                            if (hook.moduleName == name) {
                                try {
                                    let event = data;
                                    if (typeof hook.definitionVersion === 'number') {
                                        event = dispatch.base.protocol.parse(dispatch.base.protocolVersion, code, hook.definitionVersion, data);
                                    }
                                    hook.callback(event);
                                } catch (e) {
                                    command.message(`Failed to generate ${hook.name} packet to ${hook.moduleName}.`);
                                    console.warn(`Failed to generate ${hook.name} packet to ${hook.moduleName}.`);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    command.add('reload', (name) => {
        if (!name) {
            command.message("Invalid argument, module name required.");
            return;
        }

        if (!fs.existsSync(path.join(__dirname, "../", name))) {
            command.message(`The module ${name} can't be found in your node_modules folder.`);
            return;
        }

        if (!dispatch.base.isLoaded(name)) {
            command.message(`The module ${name} is not loaded.`);
            return;
        }


        dispatch.unload(name);
        unloadCachedFiles(path.join(__dirname, "../", name));

        try {
            loadModule(name);
            command.message(`Module ${name} reloaded.`);
        } catch (e) {
            command.message(`Error reloading module ${name}.`);
        }
    });

    command.add('load', (name) => {
        if (!name) {
            command.message("Invalid argument, module name required.");
            return;
        }

        if (!fs.existsSync(path.join(__dirname, "../", name))) {
            command.message(`The module ${name} can't be found in your node_modules folder.`);
            return;
        }

        if (dispatch.base.isLoaded(name)) {
            command.message(`The module ${name} is already loaded.`);
            return;
        }

        try {
            loadModule(name);
            command.message(`Module ${name} loaded.`);
        } catch (e) {
            command.message(`Error loading module ${name}.`);
        }
    });

    command.add('unload', (name) => {
        if (!name) {
            command.message("Invalid argument, module name required.");
            return;
        }

        if (!fs.existsSync(path.join(__dirname, "../", name))) {
            command.message(`The module ${name} can't be found in your node_modules folder.`);
            return;
        }

        if (!dispatch.base.isLoaded(name)) {
            command.message(`The module ${name} is not loaded.`);
            return;
        }

        dispatch.unload(name);
        unloadCachedFiles(path.join(__dirname, "../", name));
        command.message(`Module ${name} unloaded.`);
    })
}

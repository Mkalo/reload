const Command = require('command');
const fs = require("fs");
const path = require("path");

module.exports = function Reload(dispatch) {
    const command = Command(dispatch);

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
        }


        dispatch.unload(name);
        unloadCachedFiles(path.join(__dirname, "../", name));

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
    });
}
	
export default class Menu {
    /**
     * @typedef {Object} Command - A command to execute.
     * @property {Function} execute - The function to execute.
     * @property {String} [ description ] - The description of the command.
     */
    /**
     * @typedef {Object} MenuOption
     * @property {String} label - The label of the option.
     * @property {Command} command - The command to execute when the option is selected.
     * @property {String} key - The key to press to select the option.
     * @property {String} description - The description of the option.
     *
     */

    /**
     * Creates a new menu.
     *
     * @param {Object} options - The options for the menu.
     * @param {MenuOption} options.options- The options for the menu.
     * @returns {Object} The menu that was created.
     */
    constructor(options = {}) {
        this.options = options
    }

    /**
     * Add an option to the menu.
     *
     * @param {String} key - The key to press to select the option.
     * @param {MenuOption} option - The option to add.
     *
     * @returns {Object} The option that was added.
     */
    addOption(key, option) {
        this.options[key] = option
    }

    getOption(key) {
        return this.options[key]
    }

    getOptions() {
        return this.options
    }

    /**
     * Make a selection.
     *
     * @param {any} args - The arguments to pass to the command.
     */
    selectOption(option, args) {
        // Invoke the corresponding command.
        if (this.options[option]) {
            this.options[option].command.execute(args)
        }
    }
}

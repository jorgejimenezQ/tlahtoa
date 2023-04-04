import term from 'terminal-kit'
import { EventEmitter } from 'events'
import { MessagePort } from './MessagePort.js'
import Menu from './Menu.js'

var ScreenBuffer = term.ScreenBuffer
var TextBuffer = term.TextBuffer
var TextBox = term.TextBox

const terminal = term.terminal

export { Menu }
export class UI extends EventEmitter {
    /************************* */
    // private fields

    /**
     * Holds all the ports added to the UI.
     */
    #ports = []

    // holds all the messages that fit in the messagePort buffer
    #messages = []
    #moreMessages = []

    #msgInputY = 0

    #currentInput = null
    #msgPortWidth = 0
    #msgPortHeight = 0
    #currentMsgLines = 0

    #msgPortX = 1
    #msgPortY = 1

    #signInX = 1
    #signInY = 4

    #started = false

    #uiPortX = 1
    #uiPortY = 3

    #currentToken = ''

    #colorThemes = {}

    // map of the different user's usernames and their colors
    #users = new Map()
    #colors = new Set()

    /************************* */

    /************************* */
    // public fields
    /**
     * The UI port. This is the port that the UI will use to display and update the UI.
     *
     * @type {ScreenBuffer}
     */
    uiPort = null

    /**
     * The message port. This is the port view port that the UI will use to display and update the messages in the chat.
     *
     * @type {ScreenBuffer}
     * @public
     */
    messagePort = null

    /**
     * The message box. This is the box that the UI will use to display the messages in the chat.
     *
     * @type {TextBox}
     */
    messageBox = null

    /**
     * The terminal instance. This is the terminal instance that the UI will use to display the UI. The UI will be made of the different ports (messagePort, inputPort, etc.).
     *
     * @type {Terminal}
     */
    terminal = null

    #msgPrompt = 'Type your message: '
    /**
     * The UI constructor.
     *
     * @constructor
     */
    constructor() {
        super()

        this.menu = undefined
        this.menuText = ''
    }

    // display the messages

    // get input from user

    // display ui (e.g., the menu)

    // start the chat ui
    /**
     * Starts the UI.
     *
     * This method should be called after the UI object is created.
     * It will display the UI and start listening for user input.
     *
     */
    start(callback) {
        if (this.#started) return
        term.getDetectedTerminal((error, detectedTerm) => {
            if (error) {
                console.log('Error: ' + error)
                return
            }

            // Initialize the terminal.
            this.terminal = detectedTerm
            this.#setThemes()

            this.terminal.bgColor(this.#colorThemes['default'].bg)
            this.#msgInputY = this.terminal.height - 2

            // Initialize the UI port.
            this.uiPort = new ScreenBuffer({
                dst: this.terminal,
                width: this.terminal.width,
                height: this.terminal.height - this.#msgPortY - 4,
                x: this.#uiPortX,
                y: this.#uiPortY,
                attr: {
                    color: 'white',
                    bgColor: 'red',
                },
            })

            this.uiPort.fill({
                attr: {
                    color: 'white',
                    bgColor: this.#colorThemes['default'].bg,
                },
            })

            // Update the message port width and height.
            this.#msgPortWidth = this.uiPort.width / 2
            this.#msgPortHeight = this.uiPort.height

            // Create the message box.
            this.messagePort = new MessagePort({
                dst: this.uiPort,
                width: this.#msgPortWidth,
                height: this.#msgPortHeight - this.#msgPortY,
                x: this.#msgPortX,
                y: this.#msgPortY,
                term: this.terminal,
            })

            // Grab the special key inputs (e.g., CTRL_C).
            this.terminal.on('key', this.#keyInputs.bind(this))

            // clear the screen
            this.terminal.clear()

            // Call the callback function.
            if (callback) callback()
        })
        this.#started = true
    }

    async startMainScreen(callback) {
        if (!this.#started) return

        // Draw the UI.
        this.#drawUI()

        this.terminal.color256(this.#colorThemes['default'].fg)
        this.terminal.moveTo(1, this.#msgInputY, this.#msgPrompt)

        this.#detectInput()

        if (callback) callback(this)
    }

    displayMenu(menu) {
        if (!this.#started) return

        if (!this.menu) {
            this.menu = menu

            this.terminal.moveTo(1, this.terminal.height)
            this.terminal.eraseLine()

            const keys = Object.keys(this.menu)

            keys.forEach((key) => {
                const option = this.menu[key]
                const keyString = this.terminal.bold.italic.str(key)
                this.menuText += `${keyString}: ${option.label}  `
            })
        }

        this.terminal(this.menuText)
        if (this.#currentInput) this.#currentInput.redraw()
    }

    /**
     * Displays a banner at the top of the UI.
     * @param {string} message - The message to display.
     * @param {string} [ color ] - The color of the message.
     * @param {string} [ bgColor ] - The background color of the message.
     * @public
     * @example
     * ui.displayBanner('Welcome to the chat!')
     * ui.displayBanner('Welcome to the chat!', 'red')
     * ui.displayBanner('Welcome to the chat!', 'red', 'blue')
     * ui.displayBanner('Welcome to the chat!', 'red', 'blue', 'bold')
     * ui.displayBanner('Welcome to the chat!', 'red', 'blue', 'bold', 'underline')
     * ui.displayBanner('Welcome to the chat!', 'red', 'blue', 'bold', 'underline', 'blink')
     */
    banner(message, color, bgColor) {
        if (!this.#started) return

        // Clear the banner.
        this.terminal.moveTo(1, 1).eraseLine()

        this.terminal.moveTo(1, 1)
        this.terminal.bgColor(bgColor || 'black')
        this.terminal.color(color || 'white')
        this.terminal.bold(message)
        this.terminal.bgColor256(this.#colorThemes['default'].bg)
        this.terminal.color256(this.#colorThemes['default'].fg)
    }

    /**
     * Displays an input field and returns the input.
     *
     * @param {string} prompt - The prompt to display.
     * @param {number} x - The x position of the input field.
     * @param {number} y - The y position of the input field.
     * @param {RegExp} [ regex ] - The regular expression to validate the input.
     * @param {string} [ errorMessage ] - The error message to display if the regex does not match.
     * @returns {Promise} - A promise that resolves to the input.
     * @async
     * @public
     * @example
     * ui.startInputField('Username: ', 1, 1).then((input) => {
     *   console.log(input)
     * })
     * .catch((error) => {
     *  console.log(error)
     * })
     *
     */
    async startInputField(prompt, x, y, errorMessage, regex) {
        if (!this.#started) return

        this.terminal.moveTo(x, y, prompt + ': ')
        var input = await this.terminal.inputField().promise

        return new Promise((resolve, reject) => {
            if (input === undefined || input == '')
                reject(errorMessage || 'Input is undefined or empty.')
            else if (regex && !regex.test(input)) {
                reject(errorMessage || 'Input does not match the regular expression.')
            } else resolve(input)
        })
    }

    /**
     * Adds a new message to the UI.
     *
     * @param {object} message - The message to add.
     * @param {string} message.message - The message.
     * @throws {Error} - Throws an error if the message is undefined or empty.
     */
    addNewMessage(msgObject) {
        if (!this.messagePort) {
            this.terminal.error('messagePort not initialized')
            // console.log('messagePort not initialized')
            return
        }

        if (!msgObject) return
        if (msgObject.message === undefined || msgObject.message == '') return

        if (msgObject.username === undefined || msgObject.username == '')
            throw new Error('Username is undefined or empty.')

        let color = 0
        if (!this.#users.has(msgObject.username)) {
            if (msgObject.color === undefined || msgObject.color == '') {
                color = Math.floor(Math.random() * 255)
                while (this.#colors.has(color)) {
                    color = Math.floor(Math.random() * 255)
                }
                this.#colors.add(color)
                this.#users.set(msgObject.username, { color: color })
                msgObject.color = color
            } else {
                color = msgObject.color
                this.#users.set(msgObject.username, { color: color })
            }
        }

        msgObject.color = this.#users.get(msgObject.username).color

        // Add the message to the message buffer.
        this.messagePort.appendMessage(`${msgObject.username}: ${msgObject.message}`, {
            color: msgObject.color,
        })

        this.uiPort.draw()
        // this.messagePort.draw()
        // this.#drawUI()

        if (this.#currentInput) {
            this.#currentInput.redraw()
        }
    }

    terminate() {
        this.terminal.clear()
        this.terminal.moveTo(1, 1)
        this.terminal.grabInput(false)
        this.terminal.hideCursor(false)
        this.terminal.processExit(0)
    }

    // ************************************************************
    // ************* U T I L I T I E S  ***************************
    // ************************************************************

    #detectInput() {
        this.#currentInput = this.terminal.inputField(
            {
                // autoCompleteMenu: true,
                // autoComplete: ['hello', 'world'],
                // autoCompleteHint: true,
                // autoCompleteHintStyle: this.terminal.brightBlack.bgBrightWhite,
                history: true,
                tokenHook: (token, isEndOfInput, previousTokens, term, config) => {
                    this.#currentToken = previousTokens + token

                    this.terminal.saveCursor()
                },
            },
            (error, input) => {
                if (input !== '') {
                    this.emit('confirmInput', input)
                }

                this.terminal.eraseLine()
                this.terminal.color256(this.#colorThemes['default'].fg)
                this.terminal.moveTo(1, this.#msgInputY, this.#msgPrompt)
                // this.terminal.saveCursor()
                this.#detectInput()
            }
        )
    }

    #keyInputs(key) {
        switch (key) {
            case 'CTRL_C':
                this.emit('exitProgram')
                this.terminate()
                break
            // backspace
            // case 'BACKSPACE':
            //     this.#currentToken = this.#currentToken.slice(0, -1)
            //     this.terminal.moveTo(1, this.terminal.height, this.#currentToken)
            //     break
            case 'TAB':
                this.emit('tabPressed')
                break
            case 'DOWN':
                this.messagePort.scrollDown()
                break
            case 'UP':
                this.messagePort.scrollUp()
                break
            case 'CTRL_A':
                this.emit('menuKey', 'CTRL_A')
                break
            case 'CTRL_B':
                this.emit('menuKey', 'CTRL_B')
                break
            case 'CTRL_D':
                this.emit('menuKey', 'CTRL_D')
                break
            case 'CTRL_E':
                this.emit('menuKey', 'CTRL_E')
                break
            case 'CTRL_F':
                this.emit('menuKey', 'CTRL_F')
                break
            case 'CTRL_G':
                this.emit('menuKey', 'CTRL_G')
                break
            case 'CTRL_H':
                this.emit('menuKey', 'CTRL_H')
                break
            case 'CTRL_J':
                this.emit('menuKey', 'CTRL_J')
                break
            case 'CTRL_K':
                this.emit('menuKey', 'CTRL_K')
                break
            case 'CTRL_L':
                this.emit('menuKey', 'CTRL_L')
                break
            case 'CTRL_M':
                this.emit('menuKey', 'CTRL_M')
                break
            case 'CTRL_N':
                this.emit('menuKey', 'CTRL_N')
                break
            case 'CTRL_O':
                this.emit('menuKey', 'CTRL_O')
                break
            case 'CTRL_P':
                this.emit('menuKey', 'CTRL_P')
                break
            case 'CTRL_Q':
                this.emit('menuKey', 'CTRL_Q')
                break
            case 'CTRL_R':
                this.emit('menuKey', 'CTRL_R')
                break
            case 'CTRL_S':
                this.emit('menuKey', 'CTRL_S')
                break
            default:
                break
        }
    }

    #drawUI() {
        this.uiPort.draw()
        this.messagePort.draw()
        this.#displayMenu()
    }

    #setThemes() {
        this.#colorThemes = {
            '#ff0000': this.terminal.brightRed,
            '#00ff00': this.terminal.brightGreen,
            '#0000ff': this.terminal.brightBlue,
            '#ffa500': this.terminal.brightYellow,
            '#800080': this.terminal.brightMagenta,
            '#008080': this.terminal.brightCyan,
            '#ffffff': this.terminal.brightWhite,
            default: {
                fg: 255,
                bg: 0,
                // Random color from 0 to 255 using the seed as the starting point.
                // see can be a string or a number.
                getRandomColor: (seed) => {
                    const random = parseFloat
                },
            },
        }
    }

    #getForeground(color) {
        // Convert color to RGB format
        let rgbColor
        if (color.substring(0, 1) === '#') {
            // Hexadecimal format
            rgbColor = [
                parseInt(color.substring(1, 3), 16),
                parseInt(color.substring(3, 5), 16),
                parseInt(color.substring(5, 7), 16),
            ]
        } else if (color.substring(0, 3) === 'rgb') {
            // RGB or RGBA format
            rgbColor = color.match(/\d+/g).map((value) => parseInt(value))
        } else {
            throw new Error('Unsupported color format')
        }

        // Convert background color to grayscale
        const grayscaleValue = 0.299 * rgbColor[0] + 0.587 * rgbColor[1] + 0.114 * rgbColor[2]

        // Calculate contrast ratio with white and black
        const contrastRatioWhite = (grayscaleValue + 0.05) / (1.0 + 0.05)
        const contrastRatioBlack = (grayscaleValue + 0.05) / (0.0 + 0.05)

        // Choose foreground color based on contrast ratio
        return contrastRatioWhite >= contrastRatioBlack ? '#ffffff' : '#000000'
    }

    #displayMenu() {}
}

// ************************************************************
// ************* C L I E N T   C O D E   **********************
// ************************************************************
export const testClient = async () => {
    const chatMessages = [
        {
            username: 'Alice',
            message: "Hey, what's up?",
            color: 'red',
        },
        {
            username: 'Bob',
            message: 'Not much, just hanging out.',
            color: 'brightYellow',
        },
        {
            username: 'Charlie',
            message: 'Hey guys, what are you up to?',
            color: 'blue',
        },
        {
            username: 'David',
            message: 'Just finished watching a movie. How about you?',
            color: 'brightRed',
        },
        {
            username: 'Alice',
            message: 'I just got back from the gym.',
            color: 'red',
        },
        {
            username: 'Bob',
            message: 'Nice! I should start working out again.',
            color: 'brightYellow',
        },
        {
            username: 'Charlie',
            message: 'I went for a hike this morning.',
            color: 'blue',
        },
        {
            username: 'David',
            message: "That's awesome, Charlie. I love hiking!",
            color: 'brightRed',
        },
        {
            username: 'Alice',
            message: 'We should all go hiking together sometime.',
            color: 'red',
        },
        {
            username: 'Bob',
            message: 'Count me in!',
            color: 'brightYellow',
        },
        {
            username: 'Charlie',
            message: "Let's plan for next weekend.",
            color: 'blue',
        },
        {
            username: 'David',
            message: "I'm free next Saturday.",
            color: 'brightRed',
        },
        {
            username: 'Alice',
            message: 'Saturday works for me too.',
            color: 'red',
        },
        {
            username: 'Bob',
            message: "Same here. Let's do it!",
            color: 'brightYellow',
        },
        {
            username: 'Charlie',
            message: "Great, I'll find a nice trail for us.",
            color: 'blue',
        },
        {
            username: 'David',
            message: 'Looking forward to it!',
            color: 'brightRed',
        },
        {
            username: 'Alice',
            message: 'We should bring some snacks and drinks.',
            color: 'red',
        },
        {
            username: 'Bob',
            message: 'I can bring sandwiches and water.',
            color: 'brightYellow',
        },
        {
            username: 'Charlie',
            message: "I'll bring some trail mix and fruit.",
            color: 'blue',
        },
        {
            username: 'David',
            message: "I'll take care of the drinks. How about some energy drinks and juice?",
            color: 'brightRed',
        },
    ]

    const ui = new UI()
    try {
        ui.start(async () => {
            // a paragraph of text that will be wrapped
            const lorem =
                'lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec auctor, nisl eget ultricies tincidunt, nisl nisl aliquam nisl, eget aliquam nisl nisl eget nisl.'

            ui.addNewMessage({ message: lorem, username: 'anonymous', color: 125 })

            ui.on('confirmInput', (input) => {
                ui.addNewMessage({ message: input, username: 'You', color: 'green' })
            })

            // for (let i = 0; i < chatMessages.length; i++) {
            //     ui.addNewMessage(chatMessages[i])
            //     // add a delay to simulate a real chat
            //     await new Promise((resolve) => setTimeout(resolve, 1000))
            // }
        })

        ui.on('tabPressed', () => {
            if (chatMessages.length === 0) {
                ui.terminate()
            }
            const msg = chatMessages.shift()
            if (!msg) ui.terminate()
            ui.addNewMessage(msg)
        })
    } catch (error) {
        console.log(error)
    }
}

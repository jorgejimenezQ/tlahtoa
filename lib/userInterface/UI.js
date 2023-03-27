import term from 'terminal-kit'
import { EventEmitter } from 'events'
import { MessagePort } from './MessagePort.js'

var ScreenBuffer = term.ScreenBuffer
var TextBuffer = term.TextBuffer
var TextBox = term.TextBox

const terminal = term.terminal

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

    #currentInput = null
    #msgPortWidth = 0
    #msgPortHeight = 0
    #currentMsgLines = 0

    #msgPortX = 1
    #msgPortY = 5

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
        term.getDetectedTerminal((error, detectedTerm) => {
            if (error) {
                console.log('Error: ' + error)
                return
            }

            // Initialize the terminal.
            this.terminal = detectedTerm
            this.#setThemes()

            this.terminal.bgColor(this.#colorThemes['default'].bg)

            // Initialize the UI port.
            this.uiPort = new ScreenBuffer({
                dst: this.terminal,
                width: Math.min(this.terminal.width),
                height: Math.min(this.terminal.height - 5),
                x: 1,
                y: 1,
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
            this.#msgPortHeight = this.uiPort.height - 4

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

            // Detect user input
            this.terminal.moveTo(1, this.terminal.height - 1, this.#msgPrompt)
            this.#detectInput()

            // Draw the UI.
            this.messagePort.draw()
            this.uiPort.draw()

            // Call the callback function.
            if (callback) callback()
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

        if (!this.#users.has(msgObject.username)) {
            if (msgObject.color === undefined || msgObject.color == '') {
                const color = Math.floor(Math.random() * 255)
                while (this.#colors.has(color)) {
                    color = Math.floor(Math.random() * 255)
                }
                this.#colors.add(color)
                this.#users.set(msgObject.username, { color: color })
                msgObject.color = color
            } else {
                const color = msgObject.color
            }
        }

        // msgObject.color = this.#users.get(msgObject.username).color

        // Add the message to the message buffer.
        this.messagePort.appendMessage(`${msgObject.username}: ${msgObject.message}`, {
            color: msgObject.color,
        })

        this.messagePort.draw()
        this.uiPort.draw()

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
                this.terminal.moveTo(1, this.terminal.height - 1, this.#msgPrompt)
                // this.terminal.saveCursor()
                this.#detectInput()
            }
        )
    }

    #keyInputs(key) {
        switch (key) {
            case 'CTRL_C':
                this.terminate()
                break
            // backspace
            // case 'BACKSPACE':
            //     this.#currentToken = this.#currentToken.slice(0, -1)
            //     this.terminal.moveTo(1, this.terminal.height, this.#currentToken)
            //     break
            case 'UP':
                break
            case 'TAB':
                this.emit('tabPressed')
                break
            default:
                break
        }
    }

    #addPort(port) {
        this.#ports.push(port)
    }

    #drawUI() {
        this.ports.forEach((port) => {
            port.draw()
        })
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
                fg: 'black',
                bg: 0,
                // Random color from 0 to 255 using the seed as the starting point.
                // see can be a string or a number.
                getRandomColor: (seed) => {
                    const random = parseFloat
                },
            },
        }
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

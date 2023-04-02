import { EventEmitter } from 'events'
import term from 'terminal-kit'
const ScreenBuffer = term.ScreenBuffer

export class MessagePort extends EventEmitter {
    /*
     * The private properties of the MessagePort class.
     */
    #currentLine = 0
    #view = []
    #xOffset = 2
    #top = []
    #bottom = []
    #scrolled = 'none'

    // The default background color of the message port.
    #defaultBGColor = 0
    #defaultColor = 'white'

    #currentBGColor = this.#defaultBGColor

    // The current location of the most recent message. This is used to determine if the message port is scrolled up or down.  It can be: 'bottom', or 'view'.
    #currentMessageLocation = 'view'

    /**
     * Creates a new message port.
     *
     * @param {Object} options - The options for the message port.
     * @param {Number} [ options.x ] - The x position of the message port.
     * @param {Number} [options.y] - The y position of the message port.
     * @param {Number} [options.width] - The width of the message port.
     * @param {Number} [options.height] - The height of the message port.
     * @param {term.ScreenBuffer} options.dst - (required) The destination screen buffer.
     * @param {term.Terminal} options.term - (required) The terminal-kit. Used to get the ScreenBuffer class.
     */
    constructor(options = {}) {
        super()

        this.x = options.x || 1
        this.y = options.y || 4
        this.width = options.width || 0
        this.height = options.height || 0
        this.dst = options.dst || null
        this.term = options.term || null

        if (!this.term) {
            throw new Error('MessagePort requires a terminal.')
        }

        if (!this.dst) {
            throw new Error('MessagePort requires a destination screen buffer.')
        }

        this.buffer = new ScreenBuffer({
            dst: this.dst,
            width: this.width,
            height: this.height,
        })

        this.buffer.fill({
            attr: {
                bgColor: this.#defaultBGColor,
            },
        })

        // this.buffer.on('resize', () => {
        //     this.emit('resize')
        // })
    }

    /**
     * Appends a message to the message port. If the message is too long to fit on the current line, it will wrap to the next line.
     *
     * @param {Message} message - The message to append.
     * @param {Object} attr - The attributes to apply to the message. see https://github.com/cronvel/terminal-kit/blob/master/doc/ScreenBuffer.md#ref.ScreenBuffer.attributes
     *
     * @returns {void}
     */
    appendMessage(message, attr = {}) {
        // if the message port is full, scroll the message port up one line.
        const messageLines = Math.ceil(message.length / this.width)

        // Is the port scrolled?
        if (this.#currentMessageLocation === 'view') {
            // Is the message port full?
            if (this.#currentLine >= this.height - messageLines && this.#view.length > 0) {
                this.#scrollUpWithMessage(message, attr, messageLines)
            } else {
                this.#view.push({ message, attr, messageLines })
                // Draw the message on the buffer.
                this.#updateBufferWithMsg(message, attr, messageLines)
            }
        } else if (this.#currentMessageLocation === 'bottom') {
            /***** The msg port is scrolled down */
            // put the message on the bottom array
            this.#bottom.push({ message: message, attr: attr, messageLines: messageLines })
            this.emit('bottomNewMessage')
            return // Don't update the buffer since the message port is scrolled down.
        }
    }

    /**
     * Scrolls the message port down one line.
     * @returns {void}
     */
    scrollUp() {
        // Don't scroll up if the message port is already scrolled up.
        if (this.#bottom.length === 0 && this.#view.length === 1) return

        // No messages
        if (this.#view.length === 0) return

        // Shift the view up one message and add the message to the top of the view.
        const viewMessage = this.#view.shift()
        this.#top.push(viewMessage)
        this.#currentLine -= viewMessage.messageLines

        // Shift the bottom
        if (this.#bottom.length > 0) {
            const bottomMessage = this.#bottom.shift()
            this.#view.push(bottomMessage)
            this.#currentLine += bottomMessage.messageLines
        }

        this.#updateBuffer()
    }

    /**
     * Scrolls the message port down one line.
     * @returns {void}
     * */
    scrollDown() {
        // Don't scroll down if the message port is already scrolled down.
        if (this.#view.length === 0) return
        if (this.#view.length === 1 && this.#top.length === 0) return

        let viewMessage
        if (this.#top.length > 0) {
            const topMessage = this.#top.pop()
            viewMessage = this.#view.unshift(topMessage)
        }

        // Shift the bottom
        if (this.#bottom.length > 0) {
            this.#bottom.unshift(viewMessage)
        }

        this.#updateBuffer()
    }

    /************************************************************ */
    // U T I L I T Y   F U N C T I O N S
    /************************************************************ */

    #scrollUpWithMessage(message, attr, messageLines) {
        let lastMessage = this.#view.shift()
        this.#top.push(lastMessage)
        this.#currentLine -= lastMessage.messageLines

        // Shift the view up one message and add the message to the top of the view.
        // and we have more messages in the bottom
        while (this.#currentLine >= this.height - messageLines && this.#bottom.length > 0) {
            lastMessage = this.#view.shift()
            this.#top.push(lastMessage)
            this.#currentLine -= lastMessage.messageLines
        }

        // Update the current message
        this.#currentMessageLocation = 'view'
        this.#view.push({ message, attr, messageLines })

        // Update the buffer
        this.#updateBuffer()
    }

    #updateBuffer() {
        // Clear the buffer
        this.buffer.fill({
            attr: {
                bgColor: this.#defaultBGColor,
            },
        })
        this.#currentLine = 0
        this.#view.forEach((msg) => {
            this.#updateBufferWithMsg(msg.message, msg.attr, msg.messageLines)
        })
    }

    #updateBufferWithMsg(message, attr = {}, messageHeight) {
        const messageFormatted = this.term.wrapColumn({ width: this.width - 1, x: 1 }).str(message)

        // Put the message on the buffer.
        this.buffer.put(
            {
                y: this.#currentLine,
                x: this.#xOffset,
                newLine: true,
                attr: {
                    ...attr,
                    bgColor: this.#currentBGColor,
                },
            },
            messageFormatted
        )

        // Update the current line.
        this.#currentLine += messageHeight
    }

    /**
     * Sets the background color of the message port.
     *
     * @param {String} color - The color to set the background to. A number between 0 and 255.
     */
    setBGColor(color) {
        this.#currentBGColor = color
    }

    /**
     * Draws the message port.
     *
     * @param {Object} options - The options for drawing the message port.
     * @param {Number} options.x - The x position to draw the message port.
     * @param {Number} options.y - The y position to draw the message port.
     * @param {Boolean | String} options.wrap - Whether or not to wrap the message port. If a string is provided, if can be:
     * - 'x' - Wrap the message port horizontally.
     * - 'y' - Wrap the message port vertically.
     * 'both'/true - Wrap the message port both horizontally and vertically.
     *
     * @returns {void}
     *
     */
    draw(options = {}) {
        this.buffer.draw({
            // x: this.x , y: this.y, wrap: options.wrap,
            delta: true,
        })
    }

    /**
     * Getter for the current line.
     * @returns {Number}
     */
}

const fs = require('fs');
const path = require('path');
const util = require("util");

// Enable custom colors
//red, green, yellow, blue, magenta, cyan, white, gray
util.inspect.styles.number = 'yellow';
util.inspect.styles.string = 'blue';
util.inspect.styles.name   = 'gray';   // keys
util.inspect.styles.boolean = 'green';
util.inspect.styles.null = 'red';
util.inspect.styles.undefined = 'red';


const lib = {};

// lib.LogLevel = {
//     TRACE: 0,
//     DEBUG: 1,
//     INFO: 2,
//     WARN: 3,
//     ERROR: 4,
//     SILENT: 5,
// }

const esc = '\x1b[';
const end = '\x1b[0m';
//ANSI style from chalk
//first code set style and second code removes it
const styles = {
	modifier: {
		reset: [0, 0],
		// 21 isn't widely supported and 22 does the same thing
		bold: [1, 22],
		dim: [2, 22],
		italic: [3, 23],
		underline: [4, 24],
		overline: [53, 55],
		inverse: [7, 27],
		hidden: [8, 28],
		strikethrough: [9, 29],
	},
	color: {
		black: [30, 39],
		red: [31, 39],
		green: [32, 39],
		yellow: [33, 39],
		blue: [34, 39],
		magenta: [35, 39],
		cyan: [36, 39],
		white: [37, 39],

		// Bright color
		blackBright: [90, 39],
		gray: [90, 39], // Alias of `blackBright`
		grey: [90, 39], // Alias of `blackBright`
		redBright: [91, 39],
		greenBright: [92, 39],
		yellowBright: [93, 39],
		blueBright: [94, 39],
		magentaBright: [95, 39],
		cyanBright: [96, 39],
		whiteBright: [97, 39],
	},
	bgColor: {
		bgBlack: [40, 49],
		bgRed: [41, 49],
		bgGreen: [42, 49],
		bgYellow: [43, 49],
		bgBlue: [44, 49],
		bgMagenta: [45, 49],
		bgCyan: [46, 49],
		bgWhite: [47, 49],

		// Bright color
		bgBlackBright: [100, 49],
		bgGray: [100, 49], // Alias of `bgBlackBright`
		bgGrey: [100, 49], // Alias of `bgBlackBright`
		bgRedBright: [101, 49],
		bgGreenBright: [102, 49],
		bgYellowBright: [103, 49],
		bgBlueBright: [104, 49],
		bgMagentaBright: [105, 49],
		bgCyanBright: [106, 49],
		bgWhiteBright: [107, 49],
	},
};

const msgFormat = {
    error: {
        on: true, 
        style: esc + styles.color.redBright[0] + 'm',
        delim: '********** ERROR **********\n',
    },
    warn: {
        on: true, 
        style: esc + styles.color.red[0] + 'm',
        delim: '*** WARNING: ',
    },
    info: {
        on: true, 
        style: esc + styles.color.greenBright[0] + 'm',
        delim: 'INFORMATION: ',
    },
    log: {
        on: true, 
        style: esc + styles.color.greenBright[0] + 'm',
        delim: 'INFORMATION: ',
    },
    http: {
        on: true, 
        style: esc + styles.color.magenta[0] + 'm',
        delim: 'HTTP: ',
    },    
    verbose: {
        on: true, 
        style: esc + styles.color.cyan[0] + 'm',
        delim: 'VERBOSE: ',
    },
    debug: {
        on: true, 
        style: esc + styles.color.yellow[0] + 'm',
        delim: 'DEBUG: ',
    }
};

lib.LogLevel = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silent: -1,  //when set to -1 no logging takes place
};

var outputLevel = 5;  //output all levels

const logOut = (...msg) => {
    console.log(...msg);
}
lib.setLevel = (level) => {
    outputLevel = level != 'undefined' && level <= 5 && level >= 0 ? level : outputLevel;
}
/**
 * 
 * @param {msgFormat} delim specifies which message to print
 * @param  {...any} msg list of strings to be printed
 * @returns formatted and concatenated strings
 */
const combine = (msgType, ...msg) => {
    const fmtStart = msgFormat[msgType].style; 
    var rtnStr = fmtStart + msgFormat[msgType].delim;
    space = '';
    msg.forEach(el => {
        if(typeof el === 'object' && el !== null){
            rtnStr += end;
            // Pretty-print objects like console.log
            const pretty = util.inspect(el, {
                        depth: null,
                        colors: true,
                        compact: true,
                        breakLength: 120,
                        maxArrayLength: null,
                        maxStringLength: null
                    });
            if(rtnStr.charAt(rtnStr.length-1)!=='\n'){
                rtnStr += space;
            }
            rtnStr += pretty + fmtStart;
            //rtnStr += end;
            //rtnStr += el.stack + msgFormat[msgType].style + '\n' ;
        } else {
            if(rtnStr.charAt(rtnStr.length-1)!=='\n'){
                rtnStr += space;
            }
            rtnStr += el;
        }
        space = ' ';
    });
    return rtnStr + end;
};
// const combine = (msgType, ...msg) => {
//     var rtnStr = msgFormat[msgType].style + msgFormat[msgType].delim;
//     space = '';
//     msg.forEach(el => {
//         if(typeof el === 'object' && 'stack' in el){
//             if(rtnStr.charAt(rtnStr.length-1)!=='\n'){
//                 rtnStr += '\n';
//             }
//             rtnStr += end;
//             rtnStr += el.stack + msgFormat[msgType].style + '\n' ;
//         } else {
//             if(rtnStr.charAt(rtnStr.length-1)!=='\n'){
//                 rtnStr += space;
//             }
//             rtnStr += el;
//         }
//         space = ' ';
//     });
//     return rtnStr + end;
// };
/**
 * Prints regardless of level
 * @param  {...any} msg 
 * @returns 
 */
lib.log = function(...msg) {
    if (true) {
        const logMsg = combine('log', ...msg);
        logOut(logMsg);
    }
    return;
};
lib.error = function(...msg) {
    if (this.LogLevel.error <= outputLevel) {
        const logMsg = combine('error', ...msg);
        logOut(logMsg);
    }
    return;
};
lib.warn = function(...msg) {
    if (this.LogLevel.warn <= outputLevel) {
        const logMsg = combine('warn', ...msg);
        logOut(logMsg);
    }
    return;
};
lib.info = function(...msg) {
    if (this.LogLevel.info <= outputLevel) {
        const logMsg = combine('info', ...msg);
        logOut(logMsg);
    }
    return;
};
lib.http = function(...msg) {
    if (this.LogLevel.http <= outputLevel) {
        const logMsg = combine('http', ...msg);
        logOut(logMsg);
    }
    return;
};
lib.verbose = function(...msg) {
    if (this.LogLevel.verbose <= outputLevel) {
        const logMsg = combine('verbose', ...msg);
        logOut(logMsg);
    }
    return;
};
lib.debug = function(...msg) {
    if (this.LogLevel.debug <= outputLevel) {
        const logMsg = combine('debug', ...msg);
        logOut(logMsg);
    }
    return;
};


lib.test = (...msg ) => {
    console.trace('trace starts here');
}

lib.printTest = () => {
    for (var i =30; i<=37 ;i++){
    //console.log('\x1b[%d;4mm%d\t\t\x1b[%dm%d \x1b[0m', i, i, i + 60, i + 60);
    }
    
    lib.error('Before test string', new Error('Test error from main'), 'After Test String');
    lib.error(new Error('Test error'), 'After Test String');
    lib.warn('warning message format');
    lib.info('Info message', 'Second info message');
    lib.http('http message');
    lib.verbose('verbose message');
    lib.debug('debug message');
    
    // console.log("\x1b[39m\\x1b[49m                 - Reset color")
    // console.log("\\x1b[2K                          - Clear Line")
    // console.log("\\x1b[<L>;<C>H or \\x1b[<L>;<C>f  - Put the cursor at line L and column C.")
    // console.log("\\x1b[<N>A                        - Move the cursor up N lines")
    // console.log("\\x1b[<N>B                        - Move the cursor down N lines")
    // console.log("\\x1b[<N>C                        - Move the cursor forward N columns")
    // console.log("\\x1b[<N>D                        - Move the cursor backward N columns\n")
    // console.log("\\x1b[2J                          - Clear the screen, move to (0,0)")
    // console.log("\\x1b[K                           - Erase to end of line")
    // console.log("\\x1b[s                           - Save cursor position")
    // console.log("\\x1b[u                           - Restore cursor position\n")
    // console.log("\\x1b[4m                          - Underline on")
    // console.log("\\x1b[24m                         - Underline off\n")
    // console.log("\\x1b[1m                          - Bold on")
    // console.log("\\x1b[21m                         - Bold off")
}

module.exports = lib;


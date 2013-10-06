/*
 * PongServer.js
 * A skeleton server for two-player Pong game.
 * Assignment 2 for CS4344, AY2013/14.
 * Modified from Davin Choo's AY2012/13 version.
 *
 * Changes from AY2012/13:
 *  - migrate from socket.io to sockjs
 *
 * Usage: 
 *   node PongServer.js
 */

// enforce strict/clean programming
"use strict"; 

var LIB_PATH = "./";
require(LIB_PATH + "Pong.js");
require(LIB_PATH + "Ball.js");
require(LIB_PATH + "Paddle.js");
require(LIB_PATH + "Player.js");

function PongServer() {
    // Private Variables
    var port;         // Game port 
    var count;        // Keeps track how many people are connected to server 
    var nextPID;      // PID to assign to next connected player (i.e. which player slot is open) 
    var gameInterval; // Interval variable used for gameLoop
    var gameStateInterval;
    var ball;         // the game ball 
    var sockets;      // Associative array for sockets, indexed via player ID
    var players;      // Associative array for players, indexed via socket ID
    var p1, p2;       // Player 1 and 2.
	var largestDelay = 0; // largest delay
    // Ali
    var p1Inputs = new Array();
    var p2Inputs = new Array();
    var p1LastAckInputSeqNo;
    var p2LastAckInputSeqNo;

    //Update Loops Frequency
    var gameStateUpdateFrequency = 15;
    var serverSendUpdateFrequency = 45;

    //Reset Condition
    var sentReset = false;
    var serverStarted = false;

    var lastStateUpdate = new Date().getTime();
    /*
     * private method: broadcast(msg)
     *
     * broadcast takes in a JSON structure and send it to
     * all players.
     *
     * e.g., broadcast({type: "abc", x: 30});
     */
    var broadcast = function (msg) {
        var id;
        for (id in sockets) {
            sockets[id].write(JSON.stringify(msg));
        }
    }

    /*
     * private method: unicast(socket, msg)
     * unicast takes in a socket and a JSON structure
     * and send the message through the given socket.
     *
     * e.g., unicast(socket, {type: "abc", x: 30});
     */
    var unicast = function (socket, msg) {
        socket.write(JSON.stringify(msg));
    }

    /*
     * private method: reset()
     *
     * Reset the game to its initial state.  Clean up
     * any remaining timers.  Usually called when the
     * connection of a player is closed.
     */
    var reset = function () {
        // Clears gameInterval and set it to undefined
        //if (gameInterval !== undefined) {
            clearInterval(gameInterval);
            gameInterval = undefined;
        //}
        //if (gameStateInterval !== undefined){
            clearInterval(gameStateInterval);
            gameStateInterval = undefined;
        //}
        p1LastAckInputSeqNo = 0;
        p2LastAckInputSeqNo = 0;
        p1Inputs = [];
        p2Inputs = [];
    }


    /*
     * private method: newPlayer()
     *
     * Called when a new connection is detected.  
     * Create and init the new player.
     */
    var newPlayer = function (conn) {
        count ++;
        // 1st player is always top, 2nd player is always bottom
        var watchPaddle = (nextPID === 1) ? "top" : "bottom";
        var startPos = (nextPID === 1) ? Paddle.HEIGHT : Pong.HEIGHT;

        // Send message to new player (the current client)
        unicast(conn, {type: "message", content:"You are Player " + nextPID + ". Your paddle is at the " + watchPaddle});

        // Create player object and insert into players with key = conn.id
        players[conn.id] = new Player(conn.id, nextPID, startPos);
        sockets[nextPID] = conn;

        // Mark as player 1 or 2
        if (nextPID == 1) {
            p1 = players[conn.id];
        } else if (nextPID == 2) {
            p2 = players[conn.id];
        }

        // Updates the nextPID to issue (flip-flop between 1 and 2)
        nextPID = ((nextPID + 1) % 2 === 0) ? 2 : 1;
    }
    // Ali
    var processInputs = function(player, inputArr){
        var inputLength = inputArr.length;
        //check if inputs not empty
        if (inputLength){
            for (var i = 0; i < inputLength; ++i){
                var userInput = inputArr[i];

                //dont want to process inputs before inputSeqNo
                if (player.pid == 1){
                    if (userInput.seqNo <= p1LastAckInputSeqNo) continue;
                    //console.log("server p1LastAckInputSeq: " + p1LastAckInputSeqNo);
                    p1LastAckInputSeqNo = userInput.seqNo;
                    //this.lastAckInputSeqNo = userInput.seqNo;
                    var newMouseX = userInput.input;
                    player.paddle.move(newMouseX);
                    p1Inputs = new Array();
                }
                else if (player.pid == 2){
                    if (userInput.seqNo <= p2LastAckInputSeqNo) continue;
                    //console.log("server p2LastAckInputSeq: " + p2LastAckInputSeqNo);
                    p2LastAckInputSeqNo = userInput.seqNo;
                    //this.lastAckInputSeqNo = userInput.seqNo;
                    var newMouseX = userInput.input;
                    player.paddle.move(newMouseX);
                    p2Inputs = new Array();
                }

            }

        }

    }

    //Ali
    var updateGameState = function(){
        // Move paddle (in case accelerometer is used and vx is non-zero).
        p1.paddle.moveOneStep();
        p2.paddle.moveOneStep();

        // Move ball
        processInputs(p1, p1Inputs);
        processInputs(p2, p2Inputs);
        ball.moveOneStep(p1.paddle, p2.paddle,largestDelay);
        lastStateUpdate = ball.getLastUpdate();
    }
    /*
     * private method: gameLoop()
     *
     * The main game loop.  Called every interval at a
     * period roughly corresponding to the frame rate 
     * of the game
     */
    var gameLoop = function () {
        // Check if ball is moving
        if (ball.isMoving()) {

            // Update on player side
            var bx = ball.x;
            var by = ball.y;
			
			// Get largest Delay
			if( p1.getDelay() > p2.getDelay())
				largestDelay = p1.getDelay();
			else
				largestDelay = p2.getDelay();
 
			var predictedBallX = bx + (largestDelay/1000)*ball.getVx();
			var predictedBallY = by + (largestDelay/1000)*ball.getVy();
			
            var states = { 
                type: "update",
				largestDelay:largestDelay,
                lastProcessedInputSeqNo: p1LastAckInputSeqNo,
                time: new Date().getTime(), //using ball.getLastUpdate() for update msg timestamp
                //ballLastUpdate: ball.getLastUpdate(),
                ballMoving: ball.isMoving(),
                ballX: predictedBallX,
                ballY: predictedBallY,
                ballVx: ball.getVx(),
                ballVy: ball.getVy(),
                myPaddleX: p1.paddle.x,
                myPaddleY: p1.paddle.y,
                opponentPaddleX: p2.paddle.x,
                opponentPaddleY: p2.paddle.y
            };

                //console.log("ballX: " + predictedBallX);
 				//console.log("ballY: " + predictedBallY);

                setTimeout(unicast, largestDelay, sockets[1], states);
            states = { 
                type: "update",
				largestDelay:largestDelay,
                lastProcessedInputSeqNo: p2LastAckInputSeqNo,
                time: lastStateUpdate,
                //ballLastUpdate: ball.getLastUpdate(),
                ballMoving: ball.isMoving(),
                ballX: predictedBallX,
                ballY: predictedBallY,
                ballVx: ball.getVx(),
                ballVy: ball.getVy(),
                myPaddleX: p2.paddle.x,
                myPaddleY: p2.paddle.y,
                opponentPaddleX: p1.paddle.x,
                opponentPaddleY: p1.paddle.y
            };

            setTimeout(unicast, largestDelay, sockets[2], states);

            //if ball not moving
            //ball reset and server has not sent reset broadcast
            } else if (!ball.isMoving()){
                sentReset = true;
                broadcast({type:"reset"});
                reset();
        }
    }

    /*
     * private method: startGame()
     *
     * Start a new game.  Check if we have at least two 
     * players and a game is not already running.
     * If everything is OK, get the ball moving and start
     * the game loop.
     */
    var startGame = function () {
        if (gameInterval !== undefined) {
            // There is already a timer running so the game has 
            // already started.
            console.log("Already playing!");

        }
        else if (Object.keys(players).length < 2) {
            // We need two players to play.
            console.log("Not enough players!");
            broadcast({type:"message", content:"Not enough player"});

        } else {
            // Everything is a OK
            //Start Game
			console.log("Enter startgame function");
            sentReset = false;
			var startStateP1 =
			{ 
                type: "startGame",
				state: false,
                myPaddleY: p1.paddle.y,
                opponentPaddleY: p2.paddle.y
			};
            var startStateP2 =
            {
                type: "startGame",
                state: false,
                myPaddleY: p2.paddle.y,
                opponentPaddleY: p1.paddle.y
            };

			if( p1.getDelay() > p2.getDelay())
				largestDelay = p1.getDelay();
			else
				largestDelay = p2.getDelay();

            setTimeout(unicast, largestDelay, sockets[1], startStateP1);
			setTimeout(unicast, largestDelay, sockets[2], startStateP2);
            ball.startMoving();

            //Server GameState Update Loop
            gameInterval = setInterval(function() {gameLoop();}, serverSendUpdateFrequency); // serverUpdateLoop * 3 = 30ms
            gameStateInterval = setInterval(function(){ updateGameState();}, gameStateUpdateFrequency);
        }
    }//startGame()

    /*
     * priviledge method: start()
     *
     * Called when the server starts running.  Open the
     * socket and listen for connections.  Also initialize
     * callbacks for socket.
     */
    this.start = function () {
        try {
            var express = require('express');
            var http = require('http');
            var sockjs = require('sockjs');
            var sock = sockjs.createServer();

            // reinitialize 
            count = 0;
            nextPID = 1;
            gameInterval = undefined;
            ball = new Ball();
            players = new Object;
            sockets = new Object;
            
            // Upon connection established from a client socket
            sock.on('connection', function (conn) {
                console.log("connected");
                // Sends to client
                broadcast({type:"message", content:"There is now " + count + " players"});

                if (count == 2) {
                    // Send back message that game is full
                    unicast(conn, {type:"message", content:"The game is full.  Come back later"});
                    // TODO: force a disconnect
                } else {
                    // create a new player
                    newPlayer(conn);
                }

                // When the client closes the connection to the server/closes the window
                conn.on('close', function () {
                    // Stop game if it's playing
                    reset();

                    // Decrease player counter
                    count--;

                    // Set nextPID to quitting player's PID
                    nextPID = players[conn.id].pid;

                    // Remove player who wants to quit/closed the window
                    if (players[conn.id] === p1) p1 = undefined;
                    if (players[conn.id] === p2) p2 = undefined;
                    delete players[conn.id];

                    // Sends to everyone connected to server except the client
                    broadcast({type:"message", content: " There is now " + count + " players."});
                });

                // When the client send something to the server.
                conn.on('data', function (data) {
                    var message = JSON.parse(data)

                    switch (message.type) {
                        // one of the player starts the game.
                        case "start": 
                        
                        	console.log("Enter Server Start case");
                            startGame();
                            break;

                        // one of the player moves the mouse.
                        case "move":
                            setTimeout(function() {
                                players[conn.id].paddle.move(message.x);
                            },
                            players[conn.id].getDelay());
                            break;
                            
                        // one of the player moves the mouse.
                        case "accelerate":
                            setTimeout(function() {
                                players[conn.id].paddle.accelerate(message.vx);
                            },
                            players[conn.id].getDelay());
                            break;

                        // client sends restart Game
                        case "reset":
                            var resetMsg = {type: "reset"};
                            reset();
                            if (!sentReset){ //server did not send reset
                                //reset server

                                sentReset = true;
                                if (conn.id == 1){
                                    setTimeout(unicast, largestDelay, sockets[2], resetMsg);
                                }
                                else if (conn.id == 2){
                                    setTimeout(unicast, largestDelay, sockets[1], resetMsg);
                                }
                            }
							break;

                        case "input":
                            var playerID = players[conn.id];
                            var userInput = message.input;

                            if (playerID.pid == 1){
                                p1Inputs.push(userInput);
                                //console.log("p1 userInput seqNo: " + userInput.seqNo);
                            }
                            else if (playerID.pid == 2){
                                p2Inputs.push(userInput);
                            }
                            break;

                        // one of the player change the delay
                        case "delay":
                            players[conn.id].delay = message.delay;
                            break;
                        case "updateFromClient":
                            ball.x = message.x;
                            ball.y = message.y;
                            ball.setVx(message.vX);
                            ball.setVy(message.vY);
                            break
                        default:
                            console.log("Unhandled " + message.type);
                    }
                }); // conn.on("data"
            }); // socket.on("connection"

            // Standard code to starts the Pong server and listen
            // for connection
            var app = express();
            var httpServer = http.createServer(app);
            sock.installHandlers(httpServer, {prefix:'/pong'});
            httpServer.listen(Pong.PORT, '0.0.0.0');
            app.use(express.static(__dirname));

        } catch (e) {
            console.log("Cannot listen to " + port);
            console.log("Error: " + e);
        }
    }
}

// This will auto run after this script is loaded
var gameServer = new PongServer();
gameServer.start();

// vim:ts=4:sw=4:expandtab
/*
 * PongClient.js
 * A skeleton client for two-player Pong game.
 * Assignment 2 for CS4344, AY2013/14.
 * Modified from Davin Choo's AY2012/13 version.
 *
 * Changes from AY2012/13:
 *  - migrate from socket.io to sockjs
 *
 * Usage: 
 *    Include in HTML body onload to run on a web page.
 *    <body onload="loadScript('', 'PongClient.js')">
 */

// enforce strict/clean programming
"use strict"; 

function PongClient() {
    // private variables
    var socket;         // socket used to connect to server 
    var playArea;       // HTML5 canvas game window 
    var ball;           // ball object in game 
    var myPaddle;       // player's paddle in game 
    var opponentPaddle; // opponent paddle in game
    var delay;          // delay simulated on current client 
    var prevVx = 0;     // previous velocity (for accelorometer)
	var largestDelay = 0;		// the largest delay among players (for lag compensation)
	var updateTime = 0;
	var topPaddle;
	var bottomPaddle;
	var firstTime = true;
	var sentReset = false;
    var animateId;

    //Ali
    var serverUpdateArr = new Array(); // store server updates
    var bufferUpdateSize = 2; // size to store server update history

    var timeOffset = 100; // offset client by 100ms behind the server
    var smoothingPaddle = 35;
    var smoothingBall = 35;

    //Times
    var serverTime;
    var clientTime;

    //State Variables
    var stateTime = new Date().getTime();
    var curState = {
        myPaddle: new Paddle(Pong.HEIGHT),
        opponentPaddle: new Paddle(Paddle.HEIGHT),
        ball: new Ball(Pong.HEIGHT)
    }
    var oldState = {
        myPaddle: null,
        opponentPaddle: null,
        ball: null
    }

    //Input Variables
    var inputSeqNo = 0;   //last input sequence number - track of input count
    var inputs = new Array();
    var lastAckInput = null;  //last acknowledge input index in inputs array

    //Timers
    var renderDeltaTime = 0.016;
    var stateUpdateDeltaTime = 0.0001; // client game state update every 10ms
    var lastStateUpdateDeltaTime = new Date().getTime();

    var clientTime = 0.016;   //client time follows 25FPS = render each frame every 40ms
    var deltaTime = new Date().getTime();
    var lastFrameTime = new Date().getTime();

    var createTimer = function(){
        setInterval(function(){
            deltaTime = new Date().getTime() - lastFrameTime;
            lastFrameTime = new Date().getTime();
            clientTime += deltaTime/1000.0;
        }, 4);
    }

    //Client GameState Update Loop = Server Update Loop = 10ms
    var startGameStates = function(){
        setInterval(function(){
            stateUpdateDeltaTime = (new Date().getTime() - lastStateUpdateDeltaTime)/1000.0;
            lastStateUpdateDeltaTime = new Date().getTime();
            updateGameStates();
        }, 15);//1000/(Pong.FRAME_RATE * 4));
    }
    Number.prototype.fixed = function(n) { n = n || 3; return parseFloat(this.toFixed(n)); };
    /*
     * private method: lerp(previous_pos, current_post, current_time)
     */
    var lerp = function (prevPos, nextPos, middleTimePoint) {
        var middleTimePointNum = Number(middleTimePoint); //make sure its type number for maths ops
        middleTimePointNum = (Math.max(0, Math.min(1, middleTimePoint))).fixed();
        var newPos = (prevPos + middleTimePointNum * (nextPos - prevPos)).fixed();
        return newPos;
    };

    /*
     * private method: showMessage(location, msg)
     *
     * Display a text message on the web page.  The 
     * parameter location indicates the class ID of
     * the HTML element, and msg indicates the message.
     *
     * The new message replaces any existing message
     * being shown.
     */
    var showMessage = function(location, msg) {
        document.getElementById(location).innerHTML = msg; 
    }

    /*
     * private method: appendMessage(location, msg)
     *
     * Display a text message on the web page.  The 
     * parameter location indicates the class ID of
     * the HTML element, and msg indicates the message.
     *
     * The new message is displayed ON TOP of any 
     * existing messages.  A timestamp prefix is added
     * to the message displayed.
     */
    var appendMessage = function(location, msg) {
        var prev_msgs = document.getElementById(location).innerHTML;
        document.getElementById(location).innerHTML = "[" + new Date().toString() + "] " + msg + "<br />" + prev_msgs;
    }

    /*
     * private method: sendToServer(msg)
     *
     * The method takes in a JSON structure and send it
     * to the server, after converting the structure into
     * a string.
     */
    var sendToServer = function (msg) {
        socket.send(JSON.stringify(msg));
    }

    /*
     * private method: initNetwork(msg)
     *
     * Connects to the server and initialize the various
     * callbacks.
     */
    var initNetwork = function() {
        // Attempts to connect to game server
        try {
            socket = new SockJS("http://" + Pong.SERVER_NAME + ":" + Pong.PORT + "/pong");
            socket.onmessage = function (e) {
                var message = JSON.parse(e.data);
                switch (message.type) {
                case "message": 
                    appendMessage("serverMsg", message.content);
                    break;
                case "update":
                    largestDelay = message.largestDelay;
                    //ball.moving = message.ballMoving;
                    serverTime = message.time; //server update message time

                    //synchronize client time with server time
                    // set client 100ms behind the server
                    clientTime = serverTime - timeOffset/1000;

                    serverUpdateArr.push(message); //push message to array
                    //keep 50 frames worth of updates
                    if (serverUpdateArr.length >= 60*bufferUpdateSize){
                        serverUpdateArr.splice(0,1); //discard the oldest server update
                    }
                    correctPrediction();
                    break;
                //receive server msg to reset game
                //reset game condition: ball hits bottom/top wall
                case "reset":
                    //reset if client did not send the reset
                    if (!sentReset){
                        /* reset variables for new game */
                        inputs = [];
                        serverUpdateArr = [];
                        inputSeqNo = 0;
                        lastAckInput = 0;
                        lastClientUpdateTime = 0;
                        ball.setMoving(false);
                        curState.ball.setMoving(false);
                        window.cancelAnimationFrame(animateId);
                        ball.x = Pong.WIDTH/2;
                        ball.y = Pong.HEIGHT/2;
                        render();
                        sentReset = true;
                        /* stop animation */
                        //clearTimeout(animateId);
                        console.log("client reset");
                    }
                    break;

				case "startGame":
					firstTime = message.state;
                    sentReset = false; //update this as new game
                    ball.reset = false;
                    ball.startMoving();
                    myPaddle.y = message.myPaddleY;
                    opponentPaddle.y = message.opponentPaddleY;
                    updateClient();
                    //animateId = window.requestAnimationFrame(updateClient, document.getElementById('playArea'));
					break;

                default: 
                    appendMessage("serverMsg", "unhandled meesage type " + message.type);
                }
            }
        } catch (e) {
            console.log("Failed to connect to " + "http://" + Pong.SERVER_NAME + ":" + Pong.PORT);
        }
    }
    //correct local myPaddle/ball/opponent position by going through server update messages
    //new positions stored in CURSTATE
    var correctPrediction = function(){
        var latestServerUpdate = serverUpdateArr[serverUpdateArr.length - 1];
        //myPaddle position in server
        var myPaddleServerPos = {x: latestServerUpdate.myPaddleX, y: latestServerUpdate.myPaddleY};
        //var myPaddleServerGhostPos = myPaddleServerPos;

        var lastInputOnServerSeqNo = latestServerUpdate.lastProcessedInputSeqNo;

        if (lastInputOnServerSeqNo){
            var lastAckInputIndex =  -1; //lastAckInputIndex in local input list of lastProcessedInputSeqno
            //find the last input server
            for (var i = 0; i < inputs.length; ++i){
                if(inputs[i].seqNo == lastInputOnServerSeqNo){
                    lastAckInputIndex = i;
                    break;
                }
            }

            if (lastAckInputIndex != -1){
                //server acknowledge clients inputs up to myLastInputIndex in local inputs list
                //prediction from this position
                var removeAmountFromInputs = Math.abs(lastAckInputIndex - (-1));
                inputs.splice(0, removeAmountFromInputs);

                //update CURRENT STATES of myPaddle/ball to new server position
                curState.myPaddle.x = myPaddleServerPos.x;
                curState.myPaddle.y = myPaddleServerPos.y;

                curState.opponentPaddle.x = latestServerUpdate.opponentPaddleX;
                curState.opponentPaddle.y = latestServerUpdate.opponentPaddleY;
                //*******#####change to use curState.ball
                if(latestServerUpdate.ballX >= 20/2 && latestServerUpdate.ballX <= Pong.WIDTH - 20/2)
                {   //
                    if(latestServerUpdate.ballY + 20/2<= Pong.HEIGHT && latestServerUpdate.ballY - 20/2>=0)
                    {   //
                        if(latestServerUpdate.ballX - curState.ball.x > 40 || curState.ball.x - latestServerUpdate.ballX > 40 || latestServerUpdate.ballY - curState.ball.y > 40 || curState.ball.y - latestServerUpdate.ballY > 40)
                        {
                            /*
                            var lerpBallCorrection = true;
                            if (lerpBallCorrection){
                            var ballTimeDiff = latestServerUpdate.ballLastUpdate - curState.ball.lastUpdate
                            var maxTimeDiff = latestServerUpdate.ballLastUpdate - ball.lastUpdate;
                            var midPoint = (ballTimeDiff/maxTimeDiff).fixed(4);

                            if( isNaN(midPoint) ) midPoint = 0;
                            if(midPoint == -Infinity) midPoint = 0;
                            if(midPoint == Infinity) midPoint = 0;

                            //BALL next position
                            var ballNextPosX = latestServerUpdate.ballX; //ball next X position
                            var ballNextPosY = latestServerUpdate.ballY; //ball next Y position
                            //BALL prev position
                            var ballPrevPosX = ball.x; //ball prev x position
                            var ballPrevPosY = ball.y; //ball prev Y position
                            //BALL Ghost X position
                            var ballGhostX = lerp(ballPrevPosX, ballNextPosX, midPoint);
                            //BALL Ghost Y position
                            var ballGhostY = lerp(ballPrevPosY, ballNextPosY, midPoint);

                            //BALL Final Position
                            curState.ball.x =  lerp(curState.ball.x, ballGhostX, stateUpdateDeltaTime * smoothingBall);
                            curState.ball.y =  lerp(curState.ball.y, ballGhostY, stateUpdateDeltaTime * smoothingBall);
                            }*/
                            //curState.ball.moving = latestServerUpdate.moving;
                            //curState.ball.lastUpdate = latestServerUpdate.ballLastUpdate;
                            curState.ball.x = latestServerUpdate.ballX;
                            curState.ball.y = latestServerUpdate.ballY;
                            curState.ball.setVx( latestServerUpdate.ballVx );
                            curState.ball.setVy ( latestServerUpdate.ballVy );
                        }
                    }
                }
                stateTime = clientTime;
                lastAckInput = lastAckInputIndex;
                updateGameStates();
                updateLocalPosition();
            }
        }
    }
    //updates RENDERED Position from CURSTATE
    var updateLocalPosition = function(){
        //var old_state = oldState;
        var current_state = curState;
        //update what is rendered with current state of the game for myPaddle/opponent/ball

        myPaddle = current_state.myPaddle;
        opponentPaddle = current_state.opponentPaddle;
        ball = current_state.ball;
        //ball.y = current_state.ball.y;
    }

    //updates CURSTATE based on inputs
    var updateGameStates = function(){

        //set old state for clarity
        oldState.ball = ball;
        oldState.myPaddle = myPaddle;
        oldState.opponentPaddle = opponentPaddle;

        //correctPrediction() calling -> has the latest server positions
        //apply inputs to latest server positions
        //go through input list and set curState position to input position
        processInputs();
        //stateTime = clientTime;
    }

    var processInputs = function(){
        /*
        inputs array elements of type:
            {   input: myPaddle x-coor,
                seqNo: input count,
                time: time of input }
         */

        var inputsLength = inputs.length;
        if (inputsLength){ //check if inputs not empty
            for (var i = 0; i < inputsLength; ++i){
                if (inputs[i].seqNo <= lastAckInput) continue;  //do not process inputs that were before last acknowledged input from server
                  //for no velocity paddle
                    var userInput = inputs[i];
                    var newMouseX = userInput.input;
                    curState.myPaddle.move(newMouseX);
                    //myPaddle.move(newMouseX);

            }// for(var i..)
            //could calculate paddle velocity here
            //curState.myPaddle.x = curState.myPaddle.move(newMouseX);
            //myPaddle.x = curState.myPaddle.move(newMouseX); this causes the paddle to flicker

        } //if (inputsLength)

        if(inputs.length){
            //update lastAckInput
            lastAckInput = inputs[inputsLength - 1].seqNo;
        }
        if (!firstTime){
            clientMoveBall();
        }
    }

    var processServerUpdates = function(){
        //find the current time we are in
        var currentTime = clientTime;
        var prevPos = null;
        var nextPos = null;
        //look through serverUpdateArr to find where we are at
        for (var i = 0; i < serverUpdateArr.length - 1; i++){
            var update = serverUpdateArr[i];
            var nextUpdate = serverUpdateArr[i+1];

            if (currentTime > update.time && currentTime < nextUpdate.time){
                prevPos = update;
                nextPos = nextUpdate;
                break; //exit loop when found
            }
        }//end of for-loop

        //if we cannot find a nextPosition get the latest position and move there
        if(!nextPos){
            prevPos = serverUpdateArr[0];
            nextPos = serverUpdateArr[0];
        }

        if (prevPos && nextPos){
            var nextPosTime =  nextPos.time;

            //we calculate the middleTimePoint via some maths
            var timeDiff = nextPosTime - currentTime;
            var maxTimeDiff = (nextPos.time - prevPos.time).fixed(3);
            var middleTimePoint = (timeDiff/maxTimeDiff).fixed(3);

            if( isNaN(middleTimePoint) ) middleTimePoint = 0;
            if(middleTimePoint == -Infinity) middleTimePoint = 0;
            if(middleTimePoint == Infinity) middleTimePoint = 0;

            //new msgs always coming in, get latest opponentPaddle postion
            var latestServerUpdate = serverUpdateArr[serverUpdateArr.length - 1];

            //OPPONENT PADDLE server pos
            var opponentPaddleServerPos = latestServerUpdate.opponentPaddleX;
            //OPPONENT PADDLE next/previous position
            var opponentPaddleNextPos = nextPos.opponentPaddleX; //opponents paddle next position
            var opponentPaddlePrevPos = prevPos.opponentPaddleX; //opponents paddle next position
            var opponentPaddleGhost = lerp(opponentPaddlePrevPos, opponentPaddleNextPos, middleTimePoint);
            //OPPONENT PADDLE final position
            opponentPaddle.x =  lerp(opponentPaddle.x, opponentPaddleGhost, stateUpdateDeltaTime * smoothingPaddle);
            opponentPaddle.y = latestServerUpdate.opponentPaddleY;

            ball.setVx(nextPos.ballVx);
            ball.setVy(nextPos.ballVy);
            ball.x = nextPos.ballX;
            ball.y = nextPos.ballY;

            /*
            var lerpBallPos = true;
             if (lerpBallPos){

                //BALL next position
                var ballNextPosX = nextPos.ballX; //ball next X position
                var ballNextPosY = nextPos.ballY; //ball next Y position
                //BALL prev position
                var ballPrevPosX = prevPos.ballX; //ball prev x position
                var ballPrevPosY = prevPos.ballY; //ball prev Y position
                //BALL Ghost X position
                var ballGhostX = lerp(ballPrevPosX, ballNextPosX, middleTimePoint);
                //BALL Ghost Y position
                var ballGhostY = lerp(ballPrevPosY, ballNextPosY, middleTimePoint);
                var ballBeforeGhostX = ball.x;
                var ballBeforeGhostY = ball.y;
                //ball.x =  ballGhostX;
                //ball.y =  ballGhostY;
                //BALL Final Position
                ball.x =  lerp(ballBeforeGhostX, ballGhostX, stateUpdateDeltaTime * smoothingBall);
                ball.y =  lerp(ballBeforeGhostY, ballGhostY, stateUpdateDeltaTime * smoothingBall);
                //console.log("ball.x: " + ball.x + "ball y: " + ball.y);
            }
            else {
                //BALL next position
                var ballNextVX = nextPos.ballVx; //ball next X position
                var ballNextVY = nextPos.ballVy; //ball next Y position
                //BALL prev position
                var ballPrevVX = prevPos.ballVx; //ball prev x position
                var ballPrevVY = prevPos.ballVy; //ball prev Y position
                //BALL Ghost X position
                var ballGhostVX = lerp(ballPrevVX, ballNextVX, middleTimePoint);
                //BALL Ghost Y position
                var ballGhostVY = lerp(ballPrevVY, ballNextVY, middleTimePoint);
                var ballBeforeGhostVX = ball.getVx();
                var ballBeforeGhostVY = ball.getVy();
                ball.setVx(ballGhostVX);
                ball.setVy(ballGhostVY);
                //clientMoveBall();
                //BALL Final Position
                //ball.setVx(lerp(ballBeforeGhostVX, ballGhostVX, stateUpdateDeltaTime * smoothingBall));
                //ball.setVy(lerp(ballBeforeGhostVY, ballGhostVY, stateUpdateDeltaTime * smoothingBall));
                //clientMoveBall();
            }
            */

        }
    }
    /*
     * private method: initGUI
     *
     * Initialize a play area and add events.
     */
    var initGUI = function() {

        while(document.readyState !== "complete") {console.log("loading...");};

        // Sets up the canvas element
        playArea = document.getElementById("playArea");
        playArea.height = Pong.HEIGHT;
        playArea.width = Pong.WIDTH;

        // Add event handlers
        playArea.addEventListener("mousemove", function(e) {
            onMouseMove(e);
            }, false);
        playArea.addEventListener("touchmove", function(e) {
            onTouchMove(e);
            }, false);
        playArea.addEventListener("click", function(e) {
            onMouseClick(e);
            }, false);
        playArea.addEventListener("touchend", function(e) {
            onTouchEnd(e);
            }, false);
        document.addEventListener("keydown", function(e) {
            onKeyPress(e);
            }, false);
        window.addEventListener("devicemotion", function(e) {
            onDeviceMotion(e);
            }, false);
        window.ondevicemotion = function(e) {
            onDeviceMotion(e);
            }
    }

    /*
     * private method: onMouseMove
     *
     * When we detect a mouse movement, translate the mouse
     * coordinate to play area coordinate and send the new
     * mouse x-coordinate to the server.
     */
    var onMouseMove = function(e) {
        var canvasMinX = playArea.offsetLeft;
        var canvasMaxX = canvasMinX + playArea.width;
        var canvasMinY = playArea.offsetTop;
        var canvasMaxY = canvasMinX + playArea.height;
        var newMouseX = e.pageX - canvasMinX;
        var newMouseY = e.pageY - canvasMinY;

        inputSeqNo += 1;

        //snapshot of user inputs

        var userInput = {
            input: newMouseX,
            time: clientTime,
            seqNo: inputSeqNo
        }
        inputs.push(userInput);
        //store snapshot of user inputs
        //inputs.push(userInput);
        //if(ball.isMoving()){
            //console.log("Client SEND inputSeqNo: " + inputSeqNo);
            sendToServer({type:"input", input: userInput});
        //}
    }

    /*
     * private method: onMouseClick
     *
     * Starts the game if the game has not started.
     * (we check if a game has started by checking if
     * the ball is moving).
     */
    var onMouseClick = function(e) {
        if (/*!ball.isMoving()*/true) {
        console.log("mouse click detected by client!!!");
            //Send event to server
            sendToServer({type:"start"});
//test to start ball here...
			
        }
    }

    /*
     * private method: onTouchEnd
     *
     * Touch version of "mouse click" callback above.
     */
    var onTouchEnd = function(e) {
        if (!ball.isMoving()) {
            sendToServer({type:"start"});
        }
    }

    /*
     * private method: onTouchMove
     *
     * Touch version of "mouse move" callback above.
     */
    var onTouchMove = function(e) {
        var t = e.touches[0];
        var canvasMinX = playArea.offsetLeft;
        var canvasMaxX = canvasMinX + playArea.width;
        var canvasMinY = playArea.offsetTop;
        var canvasMaxY = canvasMinX + playArea.height;
        var newMouseX = t.pageX - canvasMinX;
        var newMouseY = t.pageY - canvasMinY;

        // Send event to server
        sendToServer({type:"move", x:newMouseX});
    }
    /*
     * private method: onDeviceMotion
     *
     * Get the device acceleration and use that to change the 
     * velocity of the paddle.
     */
    var onDeviceMotion = function(e) {
        var vx = e.accelerationIncludingGravity.x;
        if (vx - prevVx > 0.1 || prevVx - vx > 0.1) {
            prevVx = vx;
            // Send event to server if the accelerometer reading 
            // changes significantly.
            sendToServer({type: "accelerate", vx: vx});
        }
    }

    var onKeyPress = function(e) {
        /*
        keyCode represents keyboard button
        38: up arrow
        40: down arrow
        37: left arrow
        39: right arrow
        */
        switch(e.keyCode) {
            case 38: { // Up
                delay += 50;
                // Send event to server
                sendToServer({type:"delay", delay:delay});
                showMessage("delay", "Delay to Server: " + delay + " ms");
                break;
            }
            case 40: { // Down
                if (delay >= 50) {
                    delay -= 50;
                    // Send event to server
                    sendToServer({type:"delay", delay:delay});
                    showMessage("delay", "Delay to Server: " + delay + " ms");
                }
                break;
            }
        }
    }

    var lastClientUpdateTime = 0;
    //run every 40ms
    window.requestAnimationFrame = function( callback ){
        var currentTime = Date.now();
        var timeToUpdate = Math.max( 0, 45 - (currentTime - lastClientUpdateTime));//in seconds
        var animateFrameId = window.setTimeout(function() {callback();}, timeToUpdate);
        lastClientUpdateTime = currentTime + timeToUpdate;
        return animateFrameId;
    }

    window.cancelAnimationFrame = function ( id ) {
        window.clearTimeout(id);
        //clearInterval(id);
    }
    var updateClient = function(){
        processServerUpdates();
        updateLocalPosition();
        render();
        animateId = window.requestAnimationFrame(updateClient, document.getElementById('playArea'));

        // updateLoop = clientUpdateLoop(updateClient);
    }

    var clientMoveBall = function(){

        if(curState.myPaddle.y < curState.opponentPaddle.y)
        {
            topPaddle = curState.myPaddle;
            bottomPaddle = curState.opponentPaddle;
        }
        else
        {
            topPaddle = curState.opponentPaddle;
            bottomPaddle = curState.myPaddle;
        }
        if(curState.ball.isMoving()){ //if ball is moving, update next step.
            curState.ball.moveOneStep(topPaddle, bottomPaddle,largestDelay);
        }
        //
        //if ball not moving (ball position now updated in center)
        //since clientMoveBall is in loop
        //sentReset stops multiple reset msgs to server

       /* else if(!curState.ball.isMoving() && !sentReset) //else if ball not moving and not sentReset
        {
            //console.log("Entered Reset");

            sendToServer({type:"reset"});
            sentReset = true;
            window.cancelAnimationFrame(animateId);
            curState.ball = new Ball();
            curState.ball.moving = false;
            serverUpdateArr = [];
            inputSeqNo = 0;
            lastAckInput = 0;
            lastClientUpdateTime = 0;
            render();

        } */
    }
    /*
     * private method: render
     *
     * Draw the play area.  Called periodically at a rate
     * equals to the frame rate.
     */
    var render = function() {
        // Get context
        var context = playArea.getContext("2d");

        // Clears the playArea
        context.clearRect(0, 0, playArea.width, playArea.height);

        // Draw playArea border
        context.fillStyle = "#000000";
        context.fillRect(0, 0, playArea.width, playArea.height);

		//check ball position
        //appendMessage("serverMsg", "X: " + ball.x + "Y: " + ball.y);
        // Draw the ball
        context.fillStyle = "#ffffff";
        context.beginPath();
        context.arc(ball.x, ball.y, Ball.WIDTH/2, 0, Math.PI*2, true);
        context.closePath();
        context.fill();

        // Draw both paddles
        context.fillStyle = "#ffff00";
        context.fillRect(myPaddle.x - Paddle.WIDTH/2, 
            myPaddle.y - Paddle.HEIGHT/2,
            Paddle.WIDTH, Paddle.HEIGHT);
        context.fillRect(opponentPaddle.x - Paddle.WIDTH/2, 
            opponentPaddle.y - Paddle.HEIGHT/2,
            Paddle.WIDTH, Paddle.HEIGHT);
    }


    /*
    var requestAnimationFrame = function( callback ){
        var currentTime = Date.now();
        var timeToUpdate = Math.max( 0, 60/1000, - (currentTime - lastClientUpdateTime));//in seconds
        var animateFrameId = setTimeout(function() {callback();}, timeToUpdate);
        lastClientUpdateTime = currentTime + timeToUpdate;
        return animateFrameId;
    } */
    /*
     * priviledge method: start
     *
     * Create the ball and paddles objects, connects to
     * server, draws the GUI, and starts the rendering 
     * loop.
     */
  this.start = function() {
    // Initialize game objects
    ball = new Ball();

    // The following lines always put the player's paddle
    // at the bottom; opponent's paddle at the top.
    // But this could get overridden by the server later
    // (by the y coordinate of the paddle).
    myPaddle = new Paddle(Pong.HEIGHT);
    opponentPaddle = new Paddle(Paddle.HEIGHT);

    // Start off with no delay to the server
    delay = 0;

    // Initialize network and GUI
    initNetwork();
    initGUI();
    render();

    createTimer();
    startGameStates(); //start game state updates process user input client prediction at  15ms
   //updateClient();
    //animateId = window.requestAnimationFrame(updateClient, document.getElementById('playArea'));
    // Start drawing
    //setInterval(function() {render();}, 1000/Pong.FRAME_RATE);
    //end of this.start()
    }
}
// This will auto run after this script is loaded

// Run Client. Give leeway of 0.5 second for libraries to load
var client = new PongClient();
setTimeout(function() {client.start();}, 500);

// vim:ts=4:sw=4:expandtab
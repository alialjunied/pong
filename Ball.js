/*
 * Ball.js
 * Implementation of the ball object in Pong.
 * Assignment 2 for CS4344, AY2013/14.
 * Modified from Davin Choo's AY2012/13 version.
 *
 * Changes from AY2012/13:
 *  - distance travelled now depends on time (previously,
 *    each step is constant).
 *
 * Usage: 
 *   require('Ball.js') in both server and client.
 */

// enforce strict/clean programming
"use strict"; 

function Ball() {
    // Private variables
	var moving;	// boolean of whether ball is moving
	var lastUpdate; // timestamp of lastUpdate
	var vx;		// x-component of ball's velocity
	var vy;		// y-component of ball's velocity

	// Public variables
	this.x;		// x-coordinate of ball's position 
	this.y;		// y-coordinate of ball's position

	var reset;	//reset game

	// constructor
	var that = this;
	moving = false;
	vx = 0;
	vy = 0;
	this.x = Pong.WIDTH/2;
	this.y = Pong.HEIGHT/2;
	this.reset = false;

    /*
     * private method: updateVelocity(px)
     *
	 * Called from moveOneStep whenever the ball hits the 
	 * or paddle.  px is the x-position of the paddle.
     * 
     * The velocity changes depending on which region the ball
     * hits the paddle.
     */
	var updateVelocity = function(px) {
		// Change direction (vx) depending on collision point between ball and paddle
		if (that.x >= px - Paddle.R1 && that.x <= px + Paddle.R1) {
            vy = -vy;
        } else if (that.x >= px - Paddle.R2 && that.x <= px + Paddle.R2) {
            vx += (that.x > px? 1 : -1);
            vy = -vy;
        } else if (that.x >= px - Paddle.R3 && that.x <= px + Paddle.R3) {
            vx += (that.x > px? 2 : -2);
            vy = -vy;
        } else if (that.x + Ball.WIDTH/2 >= px - Paddle.WIDTH/2 && that.x - Ball.WIDTH/2 <= px + Paddle.WIDTH/2) {
            vx += (that.x > px? 3 : -3);
            vy = -vy;
        }
        // else = ball didn't collide with paddle
	}

    /*
     * privileged method: startMoving()
     *
	 * Change the ball velocity to non-zero and 
	 * set the moving flag to true.
     */
	this.startMoving = function(){
		that.x = Pong.WIDTH/2;
		that.y = Pong.HEIGHT/2;
		vx = 0;
		vy = Ball.VERTICAL_VELOCITY;
		moving = true;
		lastUpdate = getTimestamp();
	}
	
	  
    /*
     * priviledged method: isMoving()
     *
	 * Return true iff the ball is moving.
     */
	this.isMoving = function() {
		return moving;
	}
	this.setMoving = function(movingP) {
		moving = movingP;
	}
	
	this.setVx = function(newVx) {
		vx =  newVx;
	}
	
	this.setVy = function(newVy) {
		vy =  newVy;
	}
	
	this.getVy = function() {
		return vy;
	}
	
	this.getVx = function() {
		return vx;
	}
    this.getLastUpdate = function() {
        return lastUpdate;
    }


    /*
     * priviledged method: moveOneStep(topPaddle, bottomPaddle)
     *
	 * Called to calculate the new position of the ball.  Update 
	 * velocity if the ball hits the paddle.
     */
	this.moveOneStep = function(topPaddle, bottomPaddle,delay) {
		var now = getTimestamp(); // get the current time in millisecond resolution
		
		//Delay compensation
		var delayCompensation = (2000 - delay)/2000;

		// Update position
		if(delay > 0)
		{
			that.x += vx*delayCompensation*(now - lastUpdate)*Pong.FRAME_RATE/1000;
			that.y += vy*delayCompensation*(now - lastUpdate)*Pong.FRAME_RATE/1000;
		}
		else
		{
			// Update position
			that.x += vx*(now - lastUpdate)*Pong.FRAME_RATE/1000;
			that.y += vy*(now - lastUpdate)*Pong.FRAME_RATE/1000;
		}

		lastUpdate = now;

		// Check for bouncing
		if (that.x <= Ball.WIDTH/2 || that.x >= Pong.WIDTH - Ball.WIDTH/2) {
			// Bounds off horizontally
			vx = -vx;
		} else if (that.y + Ball.HEIGHT/2 > Pong.HEIGHT || that.y - Ball.HEIGHT/2 < 0) {
			// Goes out of bound! Lose point and restart.
			that.x = Pong.WIDTH/2;
			that.y = Pong.HEIGHT/2;
			vx = 0;
			vy = 0;
			moving = false;
			that.reset = true;
		} else if (that.y - Ball.HEIGHT/2 < Paddle.HEIGHT) {
			// Chance for ball to collide with top paddle.
			updateVelocity(topPaddle.x);
		} else if (that.y + Ball.HEIGHT/2 > Pong.HEIGHT - Paddle.HEIGHT) {
			// Chance for ball to collide with bottom paddle.
			updateVelocity(bottomPaddle.x);
		}
	}

	// the following snippet defines an appropriate high resolution 
	// getTimestamp function depends on platform.
	if (typeof window === "undefined") {
		//console.log("using process.hrtime()");
		var getTimestamp = function() { var t = process.hrtime(); return t[0]*1e3 + t[1]*1.0/1e6} 
	} else if (window.performance !== undefined) {
        if (window.performance.now) {
            //console.log("using window.performence.now()");
            var getTimestamp = function() { return window.performance.now(); };
        } else if (window.performance.webkitNow) {
            //console.log("using window.performence.webkitNow()");
            var getTimestamp = function() { return window.performance.webkitNow(); };
        }
	} else {
		//console.log("using Date.now();");
		var getTimestamp = function() { return new Date().now(); };
	}
}

// Static variables
Ball.WIDTH = 20;
Ball.HEIGHT = 20;
Ball.VERTICAL_VELOCITY = 7;

// For node.js require
global.Ball = Ball;

// vim:ts=4:sw=4:expandtab
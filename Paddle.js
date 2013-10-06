/*
 * Paddle.js
 * Implementation of the paddle objects in Pong.
 * Assignment 2 for CS4344, AY2013/14.
 * Modified from Davin Choo's AY2012/13 version.
 *
 * Changes from AY2012/13:
 *  - Added acceleration 
 *
 * Usage: 
 *   require('paddle.js') in both server and client.
 */

// enforce strict/clean programming
"use strict"; 

function Paddle(yPos){
	// Public variables
	this.x;		// x-coordinate of paddle's position 
	this.y;		// y-coordinate of paddle's position
    this.vx;    // x-velocity of the paddle

	// Constructor
	var that = this; // Unused in Paddle for now.
	this.x = Pong.WIDTH/2;
	this.y = yPos - Paddle.HEIGHT/2;
    this.vx = 0; // scaling factor is 10
}

// Static variables
Paddle.WIDTH = 60;
Paddle.HEIGHT = 16;
Paddle.R1 = 5;
Paddle.R2 = 10;
Paddle.R3 = 25;

/*
 * public method: move(newx)
 *
 * Move the paddle to new x-position, newx.  Check for
 * boundary conditions.
 */
Paddle.prototype.move = function(newx) {
	if (newx < Paddle.WIDTH/2)
		this.x = Paddle.WIDTH/2;
	else if (newx > Pong.WIDTH - Paddle.WIDTH/2)
		this.x = Pong.WIDTH - Paddle.WIDTH/2;
	else
		this.x = newx;
}

/*
 * public method: moveOneStep()
 *
 * Move the paddle to new x-position by calculating
 * the velocity.
 */
Paddle.prototype.moveOneStep = function() {

	//delay compensation
		//var delayCompensation = (2000 - delay)/1000;
	//move paddle	
	var newx = this.x + this.vx*10;//*delayCompensation; // 10 is the "scaling factor"
    this.move(newx);
}

/*
 * public method: accelerate(newvx)
 *
 * Update the velocity of the paddle.
 */
Paddle.prototype.accelerate = function(newvx) {
	this.vx = newvx;
}

// For node.js require
global.Paddle = Paddle;

// vim:ts=4:sw=4:expandtab
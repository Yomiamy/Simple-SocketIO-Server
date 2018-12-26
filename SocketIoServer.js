// [TODO:] Need to create unique room id (V)
// [TODO:] Current only one room, Need a DB (V)

// Message Type: {-1: Not a Normal message type, 0: Event Message, 1: Text Message, 2: Image Message, 3: Video Message:, 4: File Message}
// Event Response Type: {-1: Not a Normal event type, 0: Connected, 1:Create Room, 2: Join Room, 3: Leave Room, 4: Invite member}
// Room Type: {-1: Not a normal room, 0: single chat room, 1:multiple chat room}

const fs = require('fs');
const app = require('express')();
const utils = require('./utils_packs/utils');
const dbmgr = require('./db_packs/dbmgr');
const options = {
    key: fs.readFileSync('d:\\NodeJsWorkSpace\\SocketIo\\file.pem'),
    cert: fs.readFileSync('d:\\NodeJsWorkSpace\\SocketIo\\file.crt')
};
const server = require('https').createServer(options, app);
const io = require('socket.io')(server);

// [TODO:] Time millionseconds need to sync with NTP server


// Use websocket only
// io.set('transports', ['websocket']);

// Connect to MongoDB
dbmgr.connect((is_connected) => {
    if (!is_connected) {
        console.log('[LOG:] DB connect fail...');
    } else {
        console.log('[LOG:] DB connect success...');

        io.on('connection', (socket) => {
            let token = socket.handshake.query.auth_token;
            var room_id = null;

            console.log("[LOG:] " + token + " connected");
            console.log("[LOG:] Auth_Token = " + token);

            socket.on('disconnect', () => {
                console.log('[LOG:] ' + token + ' disconnected from ' + room_id);
            });

            socket.on('create-room', (room_type, user_info_list) => {
                // [TODO:] Check exist room for same members
                dbmgr.createNewRoomId((new_room_id) => {
                    if (!new_room_id) {
                        return;
                    }

                    room_id = new_room_id;
                    var room_info = {
                        "room_id": room_id,
                        "room_type": room_type,
                        "unread_count": 0,
                        "user_info_list": JSON.parse(user_info_list),
                        "last_message_timestamp": -1,
                        "last_message": ""
                    };

                    //[TODO:] Need to sync room member list
                    dbmgr.updateRoomInfo(room_info, (is_update_roominfo_success) => {
                        if (!is_update_roominfo_success) {
                            return;
                        }
                    
                        socket.emit('create-room-success', room_info);
                    });
                });
            });

            socket.on('join-room', (room_id, userInfoJsonStr) => {
                socket.join(room_id, () => {
                    let rooms = Object.values(socket.rooms);
                    let currentTimeMillions = new Date().getTime;
                    let userInfo = JSON.parse(userInfoJsonStr);

                    var eventMsg = {
                        "room_id": room_id,
                        "message_type": 0,
                        "event_response_type": 2,
                        "message_time": currentTimeMillions,
                        "message": userInfoJsonStr
                    }

                    socket.emit('join-room-success', room_id);
                    io.sockets.in(room_id).emit('receive-message', eventMsg);
                });
            })

            socket.on('leave-room', (room_id, userInfoJsonStr) => {
                console.log('[LOG:] ' + token + ' leave room ' + room_id);

                let currentTimeMillions = new Date().getTime;
                let userInfo = JSON.parse(userInfoJsonStr);

                var eventMsg = {
                    "room_id": room_id,
                    "message_type": 0,
                    "event_response_type": 3,
                    "message_time": currentTimeMillions,
                    "message": userInfoJsonStr
                }

                io.sockets.in(room_id).emit('receive-message', eventMsg);
                socket.leave(room_id);
            })

            socket.on('send-message', (msgInfoJsonStr) => {
                var msgInfoObj = JSON.parse(msgInfoJsonStr);
                let room_id = msgInfoObj.room_id;

                io.sockets.in(room_id).emit('receive-message', msgInfoJsonStr);
            })
        });
        server.listen(3000, () => {
            console.log("[LOG:] Server listening...")
        });
    }
});


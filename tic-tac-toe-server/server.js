const {
  createUser,
  getUserName,
  getRoomUsers,
  getRoom,
  removeRoom,
  removeAllRoomPlayers,
  getRandomNumber,
} = require("./handlers");

const app = require("express");

const httpServer = require("http").createServer(app);
const io = require("socket.io")(httpServer, {
  cors: {
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST"],
    allowedHeaders: ["Access-Control-Allow-Origin"],
    credentials: true,
  },
});
//List of active players
const actives = [];
io.on("connection", (socket) => {
  //Fires when user request to enter game
  socket.on("enter room", async (details) => {
    //Validate whether user may join room
    const roomValidity = RoomValidate(
      socket.id,
      details.room,
      details.username
    );
    if (roomValidity) {
      socket.join(details.room);
      //Notifies all the clients in a specific room when a user joins the game
      io.to(details.room).emit("user joined", details.username);

      //Check if game can begin
      const gameStatus = validateGame(details.room);
      if (gameStatus) {
        const players = await selectRoles(details.room)
          .then((players) => {
            return players;
          })
          .catch((err) => {
            socket.emit("error");
          });
        io.to(details.room).emit("players ready", players);
      }
    } else {
      socket.emit("room is full");
    }
  });
  //Activates when a user leaves the room
  socket.on("leaving room", (room) => {
    removeRoom(socket.id, actives);
    socket.leave(room);
  });
  //Activates when a user makes a move
  socket.on("move made", async (details) => {
    //Gets second player
    const nextPlayer = actives.find((active) => {
      return active.user.room === details.room && active.user.id !== socket.id;
    });
    //Check if the current player has won the game
    const checkForWin = checkBoard(details.updatedBoard, details.playerType);
    if (checkForWin === "game won") {
      const getWinnerName = await getUserName(socket.id, actives)
        .then((name) => {
          return name;
        })
        .catch((err) => {
          socket.emit("error");
        });
      io.to(socket.id).emit("win", {
        message: `${getWinnerName} Won!`,
        updatedBoard: details.updatedBoard,
      });
      io.to(nextPlayer.user.id).emit("lose", {
        message: `${getWinnerName} Won`,
        updatedBoard: details.updatedBoard,
      });
    }
    if (checkForWin === "tie") {
      io.to(details.room).emit("tie", {
        message: `Game tied`,
      });
    }
    if (checkForWin === "continue") {
      io.to(nextPlayer.user.id).emit("turn of player", details.updatedBoard);
    }
  });

  //Force players to quit game if one player quits
  socket.on("player quit", (room) => {
    removeAllRoomPlayers(room, actives);
    io.to(room).except(socket.id).emit("quit", { message: "Player left" });
    io.socketsLeave(room);
  });

  socket.on("disconnect", (args) => {
    getRoom(socket.id, actives).then((room) => {
      if (room) {
        io.to(room).emit("disconnectAll");
        removeRoom(socket.id, actives);
        try {
          socket.leave(room);
          console.log("success");
        } catch {
          console.log("fail", args);
        }
      } else {
        io.to(room).emit("message", `user${socket.id} failed to connect`);
      }
    });
  });
});

io.of("/rooms").on("connection", (socket) => {
  socket.on("create-room", (room, name) => {});
});

//Checks if user may join room
const RoomValidate = (id, room, nickname) => {
  const createdUser = createUser(id, nickname, room);
  //Checks if list is empty
  if (!actives.length) {
    actives.push(createdUser);
    return true;
  } else {
    const roomConnections = actives.filter((active) => {
      return room === active.user.room;
    });
    //First option: No room by that name was open
    // or has not reached the max limit
    if (roomConnections.length < 2) {
      actives.push(createdUser);
      return true;
    } else {
      return false;
    }
  }
};

//Checks if game can begin
const validateGame = (room) => {
  const numberOfPlayers = io.sockets.adapter.rooms.get(room);
  if (numberOfPlayers.size === 2) {
    return true;
  }
  return false;
};
//Assigns players game pieces
const selectRoles = async (room) => {
  const startingPlayer = getRandomNumber(0, 1);
  const players = await getRoomUsers(room, actives)
    .then((players) => {
      return players;
    })
    .catch((err) => {
      console.log(err);
    });
  if (startingPlayer === 0) {
    return [
      {
        id: players[0].user.id,
        type: "X",
        name: players[0].user.name,
      },
      {
        id: players[1].user.id,
        type: "O",
        name: players[1].user.name,
      },
    ];
  } else {
    return [
      {
        id: players[1].user.id,
        type: "X",
        name: players[1].user.name,
      },
      {
        id: players[0].user.id,
        type: "O",
        name: players[0].user.name,
      },
    ];
  }
};

//Checks game board's layout
const checkBoard = (board, type) => {
  //Conditions to win:
  //If row sequence completed
  if (
    (board["r1"]["c1"] === type &&
      board["r1"]["c2"] === type &&
      board["r1"]["c3"] === type) ||
    (board["r2"]["c1"] === type &&
      board["r2"]["c2"] === type &&
      board["r2"]["c3"] === type) ||
    (board["r3"]["c1"] === type &&
      board["r3"]["c2"] === type &&
      board["r3"]["c3"] === type)
  ) {
    return "game won";
  }
  //If column sequence completed
  if (
    (board["r1"]["c1"] === type &&
      board["r2"]["c1"] === type &&
      board["r3"]["c1"] === type) ||
    (board["r1"]["c2"] === type &&
      board["r2"]["c2"] === type &&
      board["r3"]["c2"] === type) ||
    (board["r1"]["c3"] === type &&
      board["r2"]["c3"] === type &&
      board["r3"]["c3"] === type)
  ) {
    return "game won";
  }
  //If cross sequence completed
  if (
    (board["r1"]["c1"] === type &&
      board["r2"]["c2"] === type &&
      board["r3"]["c3"] === type) ||
    (board["r1"]["c3"] === type &&
      board["r2"]["c2"] === type &&
      board["r3"]["c1"] === type)
  ) {
    return "game won";
  }
  //If no more moves left end in tie else continue the game
  for (let i in board) {
    for (let j in board[i]) {
      if (board[i][j] === null) {
        return "continue";
      }
    }
  }
  return "tie";
};

const port = process.env.PORT || 4000;
httpServer.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});

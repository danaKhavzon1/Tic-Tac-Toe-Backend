//Creates user object
const createUser = (id, name, room) => {
  return { user: { id, name, room } };
};
//Retrieves a user's name
const getUserName = async (id, actives) => {
  const userName = await actives.find((active) => active.user.id === id);

  return userName.user.name;
};
//Retrieves users in room
const getRoomUsers = async (room, actives) => {
  const roomUsers = await actives.filter((active) => active.user.room === room);

  return roomUsers;
};

//Finds matching room
const getRoom = async (id, actives) => {
  const user = await actives.find((active) => {
    return active.user.id === id;
  });
  //User has no assigned Room
  if (user) {
    return user.user.room;
  } else {
    return null;
  }
};

//Removes room from active rooms per player
const removeRoom = (id, actives) => {
  const roomIndex = actives.findIndex((active) => {
    return active.user.id === id;
  });
  actives.splice(roomIndex, 1);
};
//Removes all players from room at once
const removeAllRoomPlayers = (room, actives) => {
  const activesLength = actives.length;
  for (let i = 0; i < activesLength; i++) {
    const activesIndex = actives.findIndex((active) => {
      return active.user.room === room;
    });
    if (activesIndex !== -1) {
      actives.splice(activesIndex, 1);
    } else {
      return;
    }
  }
};

const getRandomNumber = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

module.exports = {
  createUser,
  getUserName,
  getRoomUsers,
  getRoom,
  removeRoom,
  removeAllRoomPlayers,
  getRandomNumber,
};

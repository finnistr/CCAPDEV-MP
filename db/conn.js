const mongoose = require('mongoose');

const mongoURI = process.env.MONGODB_URI;

function connectToMongo(callback) {
    mongoose.connect(mongoURI, { })
        .then(() => callback())
        .catch(err => callback(err));
}

function signalHandler() {
    console.log("Closing Mongoose connection...");
    mongoose.connection.close();
    process.exit();
}

process.on('SIGINT', signalHandler);
process.on('SIGTERM', signalHandler);
process.on('SIGQUIT', signalHandler);

module.exports = {
    connectToMongo
};

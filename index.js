// Require the fastify framework and instantiate it
const path = require("path")
const auth = require("./controllers/auth");
const jwt = require("jsonwebtoken");
const config = require("config");
const cluster = require("cluster");
let numCPUs = require("os").cpus().length;
const orderController = require("./controllers/orderController");
const userController = require("./controllers/userController");

const fastify = require("fastify")({
  logger: true,
});

// Require external modules
const mongoose = require("mongoose");

// Import Routes
const routes = require("./routes");

// Import Swagger Options
const swagger = require("./config/swagger");

// Register Swagger
fastify.register(require("fastify-swagger"), swagger.options);
fastify.register(require("fastify-formbody"));
// fastify.register(require('fastify-multipart'))
fastify.register(require("fastify-file-upload"));
fastify.register(require("fastify-cors"), {});

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, 'firebase'),
  prefix: '/',
})
// Connect to DB
mongoose
  .connect("mongodb+srv://ibrahim:GgQfcQ7MYt8hz7Q0@cluster0.ddrmy.mongodb.net/wishy?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useFindAndModify: false,
    useCreateIndex: true,
  })
  .then(() => "connect to db")
  .catch(() => "err");

// Loop over each route
routes.forEach((route, index) => {
  fastify.route(route);
});

// Run the server!
const start = async () => {
  // try {
  //   if (cluster.isMaster) {
  //     for (var i = 0; i < numCPUs; i++) {
  //       cluster.fork();
  //       cluster.fork();
  //     }
  //   } else {
  await fastify.listen(process.env.PORT || 3000, "0.0.0.0");
  fastify.swagger();
  fastify.log.info(`server listening on ${fastify.server.address().port}`);
  orderController.PendingCronOrders();
  userController.Reminders();

};
// } catch (err) {
//   fastify.log.error(err);
//   //   // process.exit(1)
// }
// }
// };

// if (cluster.isMaster) {
//   for (var i = 0; i < numCPUs; i++) {
//     cluster.fork();
//   }
// } else {
start();
// }

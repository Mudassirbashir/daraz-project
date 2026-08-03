const net = require("net");

const host = "db.wpmeihwfxahifdidgiac.supabase.co";
const ports = [5432, 6543];

ports.forEach((port) => {
  const socket = new net.Socket();
  socket.setTimeout(4000);
  socket.on("connect", () => {
    console.log(`Port ${port} on ${host} is OPEN!`);
    socket.destroy();
  });
  socket.on("timeout", () => {
    console.log(`Port ${port} on ${host} TIMED OUT.`);
    socket.destroy();
  });
  socket.on("error", (err) => {
    console.log(`Port ${port} on ${host} ERROR: ${err.message}`);
  });
  socket.connect(port, host);
});

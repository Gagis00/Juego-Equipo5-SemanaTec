// 🐍 Juego Snake - Equipo 5
// Descripción: Juego clásico de Snake hecho por el Equipo 5.
// Controla la serpiente para comer objetos y ganar puntos.
// Si chocas con la pared o contigo mismo, pierdes.

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

//configurción del canvas
canvas.width = 1000;
canvas.height = 500;

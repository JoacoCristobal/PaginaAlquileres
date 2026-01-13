const supabaseUrl = "https://dtkhsivntoxlcsxretbt.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0a2hzaXZudG94bGNzeHJldGJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTU1MDYsImV4cCI6MjA4Mjg3MTUwNn0.85V7uMyDxSoO2uJ0f-37ZkDxkptQlbLccFsU04XcEG8";
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

console.log("🟢 Supabase conectado");

/*********************************
 * HTML
 *********************************/
const tablaBody = document.getElementById("tabla-contratos");
const form = document.getElementById("form-contrato");
const inputMes = document.getElementById("mes");
const listaCalendario = document.getElementById("lista-calendario");

/*********************************
 * CONTRATOS
 *********************************/
async function cargarContratos() {
  const { data, error } = await db
    .from("contratos")
    .select("*")
    .order("fecha_inicio");

  if (error) {
    console.error(error);
    return;
  }

  tablaBody.innerHTML = "";

  data.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.inquilino}</td>
      <td>${c.calle} ${c.numero}</td>
      <td>${c.tipo_contrato}</td>
      <td>${c.fecha_inicio}</td>
      <td>${c.fecha_fin}</td>
    `;
    tablaBody.appendChild(tr);
  });
}

/*********************************
 * FECHAS
 *********************************/
function generarActualizaciones(fechaInicio, fechaFin, tipo) {
  const fechas = []
let meses = 12

if (tipo === "trimestral") meses = 3
if (tipo === "cuatrimestral") meses = 4
if (tipo === "semestral") meses = 6


  const inicio = new Date(fechaInicio)
  const fin = new Date(fechaFin)

  let year = inicio.getFullYear()
  let month = inicio.getMonth()
  const day = inicio.getDate()

  while (true) {
    month += meses

    const fecha = new Date(year, month, day)

    if (fecha > fin) break

    fechas.push(fecha.toISOString().split("T")[0])

    year = fecha.getFullYear()
    month = fecha.getMonth()
  }

  return fechas
}


/*********************************
 * INSERTAR
 *********************************/
async function insertarContrato(e) {
  e.preventDefault();

  const contratoNuevo = {
    inquilino: inquilino.value,
    calle: calle.value,
    numero: numero.value,
    tipo_contrato: tipo_contrato.value,
    fecha_inicio: fecha_inicio.value,
    fecha_fin: fecha_fin.value
  };

  const { data, error } = await db
    .from("contratos")
    .insert([contratoNuevo])
    .select();

  if (error) {
    alert(error.message);
    return;
  }

  const contrato = data[0];

  const fechas = generarActualizaciones(
    contrato.fecha_inicio,
    contrato.fecha_fin,
    contrato.tipo_contrato
  );

  if (fechas.length) {
    await db.from("actualizaciones").insert(
      fechas.map(f => ({
        contrato_id: contrato.id,
        fecha_actualizacion: f
      }))
    );
  }

  form.reset();
  cargarContratos();
}

/*********************************
 * ACTUALIZACIONES (FIX FINAL)
 *********************************/
async function cargarActualizaciones() {
  const mes = inputMes.value
  if (!mes) return

  const [anio, mesNum] = mes.split("-")

  const inicio = new Date(anio, mesNum - 1, 1)
  const fin = new Date(anio, mesNum, 0) // último día real del mes

  const inicioISO = inicio.toISOString().split("T")[0]
  const finISO = fin.toISOString().split("T")[0]

  const { data, error } = await db
    .from("actualizaciones")
    .select(`
      fecha_actualizacion,
      contratos:contrato_id (
        inquilino,
        calle,
        numero
      )
    `)
    .gte("fecha_actualizacion", inicioISO)
    .lte("fecha_actualizacion", finISO)
    .order("fecha_actualizacion")

  if (error) {
    console.error(error)
    return
  }

  listaCalendario.innerHTML = ""

  if (data.length === 0) {
    listaCalendario.innerHTML = "<li>No hay actualizaciones este mes</li>"
    return
  }

  data.forEach(a => {
    const li = document.createElement("li")
    li.textContent =
      `${a.fecha_actualizacion} - ${a.contratos.inquilino} (${a.contratos.calle} ${a.contratos.numero})`
    listaCalendario.appendChild(li)
  })
}


/*********************************
 * EVENTOS
 *********************************/
form.addEventListener("submit", insertarContrato);
inputMes.addEventListener("change", cargarActualizaciones);

/*********************************
 * INIT
 *********************************/
cargarContratos();
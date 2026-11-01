/*********************************
 * SUPABASE
 * La "anon key" es pública por diseño: la seguridad real la dan
 * el login (Supabase Auth) y las políticas RLS (ver seguridad.sql).
 *********************************/
const supabaseUrl = "https://dtkhsivntoxlcsxretbt.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0a2hzaXZudG94bGNzeHJldGJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTU1MDYsImV4cCI6MjA4Mjg3MTUwNn0.85V7uMyDxSoO2uJ0f-37ZkDxkptQlbLccFsU04XcEG8";
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

/*********************************
 * HTML
 *********************************/
const $ = id => document.getElementById(id);

const vistaLogin = $("vista-login");
const vistaApp = $("vista-app");
const formLogin = $("form-login");
const loginError = $("login-error");
const btnLogin = $("btn-login");
const btnLogout = $("btn-logout");
const usuarioEmail = $("usuario-email");

const tablaBody = $("tabla-contratos");
const contador = $("contador-contratos");
const form = $("form-contrato");
const btnGuardar = $("btn-guardar");
const inputMes = $("mes");
const listaCalendario = $("lista-calendario");

const dlgBorrar = $("dlg-borrar");
const dlgDetalle = $("dlg-detalle");
const dlgConfirmar = $("dlg-confirmar");
const dlgCancelar = $("dlg-cancelar");
const formBorrar = $("form-borrar");
const toast = $("toast");

/*********************************
 * UTILIDADES
 *********************************/
const NOMBRES_TIPO = {
  trimestral: "Trimestral",
  cuatrimestral: "Cuatrimestral",
  semestral: "Semestral"
};

// "2026-03-05" -> "05/03/2026" (sin pasar por Date para evitar corrimientos de zona horaria)
function formatearFecha(iso) {
  if (!iso) return "";
  const [a, m, d] = String(iso).split("-");
  return `${d}/${m}/${a}`;
}

function aISO(year, monthIndex, day) {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

let toastTimer;
function avisar(texto, esError = false) {
  toast.textContent = texto;
  toast.classList.toggle("error-toast", esError);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function celda(texto, clase) {
  const td = document.createElement("td");
  td.textContent = texto; // textContent: nunca interpreta HTML
  if (clase) td.className = clase;
  return td;
}

/*********************************
 * SESIÓN (LOGIN / LOGOUT)
 *********************************/
function mostrarLogin() {
  vistaApp.hidden = true;
  vistaLogin.hidden = false;
  tablaBody.innerHTML = "";
  listaCalendario.innerHTML = "";
}

function mostrarApp(user) {
  vistaLogin.hidden = true;
  vistaApp.hidden = false;
  usuarioEmail.textContent = user.email || "";
  iniciarApp();
}

formLogin.addEventListener("submit", async e => {
  e.preventDefault();
  loginError.hidden = true;
  btnLogin.disabled = true;
  btnLogin.textContent = "Ingresando…";

  const { error } = await db.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-password").value
  });

  btnLogin.disabled = false;
  btnLogin.textContent = "Entrar";

  if (error) {
    // Mensaje genérico: no revela si el correo existe o no
    loginError.textContent = "Correo o contraseña incorrectos.";
    loginError.hidden = false;
    return;
  }
  formLogin.reset();
});

btnLogout.addEventListener("click", async () => {
  await db.auth.signOut();
});

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
    avisar("No se pudieron cargar los contratos.", true);
    return;
  }

  tablaBody.innerHTML = "";

  if (data.length === 0) {
    const tr = document.createElement("tr");
    const td = celda("Todavía no hay contratos cargados.", "vacio");
    td.colSpan = 6;
    tr.appendChild(td);
    tablaBody.appendChild(tr);
    contador.textContent = "Sin contratos";
    return;
  }

  contador.textContent = data.length === 1 ? "1 contrato" : `${data.length} contratos`;

  data.forEach(c => {
    const tr = document.createElement("tr");

    tr.appendChild(celda(c.inquilino, "celda-principal"));
    tr.appendChild(celda(`${c.calle} ${c.numero}`));

    const tdTipo = document.createElement("td");
    const tag = document.createElement("span");
    tag.className = "etiqueta";
    tag.textContent = NOMBRES_TIPO[c.tipo_contrato] || c.tipo_contrato;
    tdTipo.appendChild(tag);
    tr.appendChild(tdTipo);

    tr.appendChild(celda(formatearFecha(c.fecha_inicio)));
    tr.appendChild(celda(formatearFecha(c.fecha_fin)));

    const tdAcc = document.createElement("td");
    tdAcc.className = "col-acc";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-borrar";
    btn.textContent = "Borrar";
    btn.dataset.id = c.id;
    btn.dataset.detalle = `${c.inquilino} — ${c.calle} ${c.numero}`;
    tdAcc.appendChild(btn);
    tr.appendChild(tdAcc);

    tablaBody.appendChild(tr);
  });
}

/*********************************
 * FECHAS
 *********************************/
function generarActualizaciones(fechaInicio, fechaFin, tipo) {
  const fechas = [];
  let meses = 12;

  if (tipo === "trimestral") meses = 3;
  if (tipo === "cuatrimestral") meses = 4;
  if (tipo === "semestral") meses = 6;

  // Se leen año/mes/día directo del texto "YYYY-MM-DD".
  // (new Date("2026-03-05") se interpreta en UTC y en Argentina corre el día a 04/03)
  const [y, m, d] = fechaInicio.split("-").map(Number);
  const limite = fechaFin; // el formato ISO se puede comparar como texto

  for (let k = 1; ; k++) {
    const totalMeses = (m - 1) + meses * k;
    const year = y + Math.floor(totalMeses / 12);
    const month = totalMeses % 12;

    // Si el día no existe en ese mes (ej. 31 de abril), usa el último día del mes
    const ultimoDia = new Date(year, month + 1, 0).getDate();
    const iso = aISO(year, month, Math.min(d, ultimoDia));

    if (iso > limite) break;
    fechas.push(iso);
  }

  return fechas;
}

/*********************************
 * INSERTAR
 *********************************/
async function insertarContrato(e) {
  e.preventDefault();

  const contratoNuevo = {
    inquilino: $("inquilino").value.trim(),
    calle: $("calle").value.trim(),
    numero: $("numero").value,
    tipo_contrato: $("tipo_contrato").value,
    fecha_inicio: $("fecha_inicio").value,
    fecha_fin: $("fecha_fin").value
  };

  if (!contratoNuevo.inquilino || !contratoNuevo.calle) {
    avisar("Completá el inquilino y la calle.", true);
    return;
  }
  if (contratoNuevo.fecha_fin <= contratoNuevo.fecha_inicio) {
    avisar("La fecha de fin debe ser posterior a la de inicio.", true);
    return;
  }

  btnGuardar.disabled = true;

  const { data, error } = await db
    .from("contratos")
    .insert([contratoNuevo])
    .select();

  if (error) {
    console.error(error);
    avisar("No se pudo guardar el contrato.", true);
    btnGuardar.disabled = false;
    return;
  }

  const contrato = data[0];

  const fechas = generarActualizaciones(
    contrato.fecha_inicio,
    contrato.fecha_fin,
    contrato.tipo_contrato
  );

  if (fechas.length) {
    const { error: errAct } = await db.from("actualizaciones").insert(
      fechas.map(f => ({
        contrato_id: contrato.id,
        fecha_actualizacion: f
      }))
    );
    if (errAct) {
      console.error(errAct);
      avisar("Contrato guardado, pero fallaron las fechas de actualización.", true);
    }
  }

  btnGuardar.disabled = false;
  form.reset();
  avisar("Contrato guardado.");
  cargarContratos();
  cargarActualizaciones();
}

/*********************************
 * BORRAR
 *********************************/
let idPorBorrar = null;

tablaBody.addEventListener("click", e => {
  const btn = e.target.closest(".btn-borrar");
  if (!btn) return;
  idPorBorrar = btn.dataset.id;
  dlgDetalle.textContent = btn.dataset.detalle;
  dlgBorrar.showModal();
});

dlgCancelar.addEventListener("click", () => {
  idPorBorrar = null;
  dlgBorrar.close();
});

formBorrar.addEventListener("submit", async e => {
  e.preventDefault();
  if (!idPorBorrar) return;

  dlgConfirmar.disabled = true;
  dlgConfirmar.textContent = "Borrando…";

  // Primero las fechas de actualización, después el contrato
  const { error: errAct } = await db
    .from("actualizaciones")
    .delete()
    .eq("contrato_id", idPorBorrar);

  let errCon = null;
  if (!errAct) {
    const res = await db.from("contratos").delete().eq("id", idPorBorrar);
    errCon = res.error;
  }

  dlgConfirmar.disabled = false;
  dlgConfirmar.textContent = "Sí, borrar";
  dlgBorrar.close();
  idPorBorrar = null;

  if (errAct || errCon) {
    console.error(errAct || errCon);
    avisar("No se pudo borrar el contrato.", true);
    return;
  }

  avisar("Contrato borrado.");
  cargarContratos();
  cargarActualizaciones();
});

/*********************************
 * ACTUALIZACIONES
 *********************************/
async function cargarActualizaciones() {
  const mes = inputMes.value;
  if (!mes) return;

  const [anio, mesNum] = mes.split("-").map(Number);
  const ultimoDia = new Date(anio, mesNum, 0).getDate(); // último día real del mes

  const inicioISO = aISO(anio, mesNum - 1, 1);
  const finISO = aISO(anio, mesNum - 1, ultimoDia);

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
    .order("fecha_actualizacion");

  if (error) {
    console.error(error);
    avisar("No se pudo cargar el calendario.", true);
    return;
  }

  listaCalendario.innerHTML = "";

  if (data.length === 0) {
    const li = document.createElement("li");
    li.className = "sin-datos";
    li.textContent = "No hay actualizaciones este mes";
    listaCalendario.appendChild(li);
    return;
  }

  data.forEach(a => {
    const li = document.createElement("li");

    const fecha = document.createElement("span");
    fecha.className = "cal-fecha";
    fecha.textContent = formatearFecha(a.fecha_actualizacion);

    const detalle = document.createElement("span");
    detalle.className = "cal-detalle";
    const c = a.contratos;
    detalle.textContent = c ? c.inquilino : "(contrato eliminado)";
    if (c) {
      const small = document.createElement("small");
      small.textContent = `${c.calle} ${c.numero}`;
      detalle.appendChild(small);
    }

    li.append(fecha, detalle);
    listaCalendario.appendChild(li);
  });
}

/*********************************
 * EVENTOS
 *********************************/
form.addEventListener("submit", insertarContrato);
inputMes.addEventListener("change", cargarActualizaciones);

/*********************************
 * INIT
 *********************************/
let appIniciada = false;

function iniciarApp() {
  if (!inputMes.value) {
    const hoy = new Date();
    inputMes.value = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  }
  cargarContratos();
  cargarActualizaciones();
}

db.auth.onAuthStateChange((evento, session) => {
  if (session && session.user) {
    // Evita recargar todo cuando solo se renueva el token
    if (!appIniciada || evento === "SIGNED_IN") {
      appIniciada = true;
      mostrarApp(session.user);
    }
  } else {
    appIniciada = false;
    mostrarLogin();
  }
});

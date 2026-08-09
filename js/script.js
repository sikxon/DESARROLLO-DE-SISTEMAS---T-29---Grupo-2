document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas ? canvas.getContext("2d") : null;
    const boton = document.querySelector(".bloque_control button");
    const micStatus = document.getElementById("micStatus");
    const nivel = document.getElementById("nivel");
    const dbNivel = document.getElementById("valor_decibelios");
    const levelFill = document.getElementById("levelFill");
    const voz = document.getElementById("voz");

    let stream = null;
    let audioContext = null;
    let source = null;
    let analyser = null;
    let dataArray = null;
    let freqData = null;
    let animacion = null;
    let medicionActiva = false;

    let nivelSonido = document.getElementById("nivelSonido");
    if (!nivelSonido && canvas) {
        nivelSonido = document.createElement("div");
        nivelSonido.id = "nivelSonido";
        nivelSonido.innerHTML = "Nivel de sonido: --";
        Object.assign(nivelSonido.style, { marginTop: "15px", fontSize: "18px", fontWeight: "bold", color: "#aaaaaa" });
        canvas.insertAdjacentElement("afterend", nivelSonido);
    }

    async function iniciar() {
        if (medicionActiva) {
            detenerMicrofono();
            return;
        }

        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === "suspended") await audioContext.resume();

            source = audioContext.createMediaStreamSource(stream);
            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            source.connect(analyser);

            dataArray = new Uint8Array(analyser.fftSize);
            freqData = new Uint8Array(analyser.frequencyBinCount);

            medicionActiva = true;
            if (boton) boton.textContent = "Desactivar Micrófono";
            if (micStatus) { micStatus.innerHTML = "Activo"; micStatus.style.color = "#f15b45"; }

            dibujar();
        } catch (error) {
            console.error("Error al activar el micrófono:", error);
            if (micStatus) { micStatus.innerHTML = "Sin acceso"; micStatus.style.color = "#f15b45"; }
            if (voz) { voz.innerHTML = "No se pudo activar el micrófono"; voz.style.color = "#f15b45"; }
        }
    }

    function dibujar() {
        if (!medicionActiva) return;
        animacion = requestAnimationFrame(dibujar);

        analyser.getByteTimeDomainData(dataArray);
        ctx.fillStyle = "#202020";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "rgba(170,170,170,0.25)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        ctx.lineWidth = 2;
        ctx.strokeStyle = "#f15b45";
        ctx.beginPath();

        const sliceWidth = canvas.width / dataArray.length;
        let x = 0, suma = 0;

        for (let i = 0; i < dataArray.length; i++) {
            const v = (dataArray[i] - 128) / 128.0;
            const y = (canvas.height / 2) + v * (canvas.height / 2);
            suma += v * v;

            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            x += sliceWidth;
        }
        ctx.stroke();

        analyser.getByteFrequencyData(freqData);
        const bars = 60;
        const step = Math.floor(freqData.length / bars);
        const barWidth = canvas.width / bars;

        for (let i = 0; i < bars; i++) {
            const percent = freqData[i * step] / 255;
            const barHeight = percent * canvas.height * 0.5;
            ctx.fillStyle = `rgba(241, 91, 69, ${0.25 + percent * 0.75})`;
            ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth - 2, barHeight);
        }

        const rms = Math.sqrt(suma / dataArray.length);
        let db = rms > 0 ? 20 * Math.log10(rms) : -60;
        db = Math.max(-60, Math.min(0, db));
        const porcentaje = ((db + 60) / 60) * 100;

        if (nivel) nivel.innerHTML = `Nivel: ${porcentaje.toFixed(0)} %`;
        if (dbNivel) dbNivel.innerHTML = db.toFixed(1);
        if (levelFill) levelFill.style.width = `${porcentaje}%`;

        if (nivelSonido) {
            const estado = db <= -50 ? ["Silencioso", "#aaaaaa"] :
                           db <= -35 ? ["Bajo", "#8fb3a0"] :
                           db <= -20 ? ["Medio", "#f5b942"] :
                           db <= -10 ? ["Alto", "#f15b45"] : ["Muy alto", "#ff7259"];
            nivelSonido.innerHTML = `Nivel de sonido: ${estado[0]}`;
            nivelSonido.style.color = estado[1];
        }

        const inicio = Math.floor(freqData.length * 0.05);
        const fin = Math.floor(freqData.length * 0.25);
        let energiaVoz = 0;
        for (let i = inicio; i < fin; i++) energiaVoz += freqData[i];
        energiaVoz /= (fin - inicio);

        if (voz) {
            const hayVoz = rms > 0.02 && energiaVoz > 30;
            voz.innerHTML = hayVoz ? "Estado: Voz detectada" : "Estado: Ruido / silencio";
            voz.style.color = hayVoz ? "#f15b45" : "#aaaaaa";
        }
    }

    function detenerMicrofono() {
        if (animacion) cancelAnimationFrame(animacion);
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (source) source.disconnect();
        if (audioContext) audioContext.close();

        stream = audioContext = source = analyser = animacion = null;
        medicionActiva = false;

        if (boton) boton.textContent = "Activar Micrófono";
        if (micStatus) { micStatus.innerHTML = "Desactivado"; micStatus.style.color = "#aaaaaa"; }
        if (nivel) nivel.innerHTML = "Nivel: 0 %";
        if (dbNivel) dbNivel.innerHTML = "-60.0";
        if (levelFill) levelFill.style.width = "0%";
        if (nivelSonido) { nivelSonido.innerHTML = "Nivel de sonido: --"; nivelSonido.style.color = "#aaaaaa"; }
        if (voz) { voz.innerHTML = "Estado: ---"; voz.style.color = "#aaaaaa"; }

        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = "#202020";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    if (boton) {
        boton.addEventListener("click", iniciar);
    }
});
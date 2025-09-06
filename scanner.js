document.addEventListener('DOMContentLoaded', () => {
    const startScanBtn = document.getElementById('start-scan-btn');
    const cameraView = document.getElementById('camera-view');
    const resultElement = document.getElementById('result');
    let stream = null;

    // 1. Verifica se o navegador suporta a API BarcodeDetector
    if (!('BarcodeDetector' in window)) {
        alert('Seu navegador não suporta a detecção de código de barras.');
        startScanBtn.disabled = true;
        return;
    }

    const barcodeDetector = new BarcodeDetector({
        formats: ['code_128', 'ean_13', 'qr_code'] // Adicione outros formatos se necessário
    });

    startScanBtn.addEventListener('click', async () => {
        resultElement.textContent = '...'; // Limpa o resultado anterior
        cameraView.style.display = 'block'; // Mostra o vídeo

        try {
            // 2. Pede permissão e inicia a câmera
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Prefere a câmera traseira
            });
            cameraView.srcObject = stream;
            await cameraView.play();

            // 3. Inicia a detecção de códigos de barras
            detectBarcode();

        } catch (error) {
            console.error('Erro ao acessar a câmera:', error);
            alert('Não foi possível acessar a câmera. Verifique as permissões.');
            cameraView.style.display = 'none';
        }
    });

    async function detectBarcode() {
        try {
            const barcodes = await barcodeDetector.detect(cameraView);

            if (barcodes.length > 0) {
                // 4. Código de barras encontrado!
                const barcodeValue = barcodes[0].rawValue;
                resultElement.textContent = barcodeValue;
                console.log('Código de barras detectado:', barcodeValue);

                // Para o vídeo e a câmera
                stream.getTracks().forEach(track => track.stop());
                cameraView.style.display = 'none';
                return; // Para a detecção
            }

            // Se nenhum código for encontrado, tenta novamente no próximo frame
            requestAnimationFrame(detectBarcode);
        } catch (error) {
            console.error('Erro na detecção do código de barras:', error);
        }
    }
});

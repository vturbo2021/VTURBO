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
        resultElement.textContent = 'Procurando...'; // Atualiza o status
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
                console.log('Código de barras detectado:', barcodeValue);

                // Para o vídeo e a câmera
                stream.getTracks().forEach(track => track.stop());
                cameraView.style.display = 'none';

                // AGORA, VAMOS PESQUISAR O CÓDIGO NA PLANILHA
                searchBarcodeInSheet(barcodeValue);

                return; // Para a detecção
            }

            // Se nenhum código for encontrado, tenta novamente no próximo frame
            requestAnimationFrame(detectBarcode);
        } catch (error) {
            console.error('Erro na detecção do código de barras:', error);
        }
    }

    async function searchBarcodeInSheet(barcode) {
        resultElement.textContent = 'Verificando na planilha...';

        // Constrói a URL para a API do Google Sheets
        const range = `${SHEET_NAME}!A:C`; // Pesquisa na coluna A e retorna dados das colunas A, B e C
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Erro ao acessar a planilha. Verifique as permissões e a chave de API.');
            }

            const data = await response.json();
            const rows = data.values;

            if (rows) {
                const foundRow = rows.find(row => row[0] === barcode); // Procura o código na primeira coluna (índice 0)

                if (foundRow) {
                    // Código encontrado! Exibe os dados.
                    // Exemplo: "Caixa Média - Status: Em trânsito"
                    const productInfo = foundRow[1] || 'N/A';
                    const statusInfo = foundRow[2] || 'N/A';
                    resultElement.innerHTML = `<strong>${productInfo}</strong><br>Status: ${statusInfo}`;
                } else {
                    // Código não encontrado na planilha
                    resultElement.textContent = `Código ${barcode} não encontrado!`;
                }
            } else {
                resultElement.textContent = 'Planilha vazia ou não encontrada.';
            }
        } catch (error) {
            console.error('Erro na busca:', error);
            resultElement.textContent = 'Falha na comunicação com a planilha.';
        }
    }
});

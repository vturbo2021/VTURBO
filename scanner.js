document.addEventListener('DOMContentLoaded', () => {
    const startScanBtn = document.getElementById('start-scan-btn');
    const cameraView = document.getElementById('camera-view');
    const resultElement = document.getElementById('result');
    const barcodeInput = document.getElementById('barcode-input');
    let stream = null;
    // Elementos para a captura de fotos
    const photoCaptureContainer = document.getElementById('photo-capture-container');
    const startPhotoBtn = document.getElementById('start-photo-btn');
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const photoCanvas = document.getElementById('photo-canvas');

    let barcodeDetector = null;

    // 1. Verifica se o navegador suporta a API BarcodeDetector
    if (!('BarcodeDetector' in window)) {
        // Se não suporta, simplesmente esconde o botão da câmera.
        document.getElementById('camera-button-container').style.display = 'none';
    } else {
        barcodeDetector = new BarcodeDetector({
            formats: ['code_128', 'ean_13', 'qr_code'] // Adicione outros formatos se necessário
        });
    }

    startScanBtn.addEventListener('click', async () => {
        if (!barcodeDetector) return; // Não faz nada se a API não for suportada
        
        // Garante que a seção de fotos esteja escondida ao iniciar um novo scan
        photoCaptureContainer.style.display = 'none';

        // Esconde o input para dar espaço para a câmera
        document.getElementById('input-container').style.display = 'none';
        resultElement.textContent = 'Aponte para o código...';

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

    // Lógica para o scanner de mão (input de texto)
    barcodeInput.addEventListener('keypress', (event) => {
        // Verifica se a tecla pressionada foi "Enter"
        if (event.key === 'Enter') {
            event.preventDefault(); // Impede o comportamento padrão do Enter (ex: submeter um formulário)
            const barcodeValue = barcodeInput.value.trim();

            if (barcodeValue) {
                searchBarcodeInSheet(barcodeValue);
                // Limpa o campo e o foca novamente para o próximo scan
                barcodeInput.value = '';
                barcodeInput.focus();
            }
        }
    });

    async function detectBarcode() {
        if (!barcodeDetector) return; // Garante que não execute se não for suportado

        try {
            const barcodes = await barcodeDetector.detect(cameraView);

            if (barcodes.length > 0) {
                // 4. Código de barras encontrado!
                const barcodeValue = barcodes[0].rawValue;
                console.log('Código de barras detectado:', barcodeValue);

                // Para o vídeo e a câmera
                stream.getTracks().forEach(track => track.stop());
                cameraView.style.display = 'none';
                
                // Mostra o input novamente
                document.getElementById('input-container').style.display = 'flex';

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

        // Adiciona uma verificação para garantir que as variáveis de config existem
        if (typeof GOOGLE_API_KEY === 'undefined' || typeof SPREADSHEET_ID === 'undefined') {
            resultElement.textContent = 'Erro: Arquivo de configuração não encontrado.';
            return;
        }
        if (typeof APPS_SCRIPT_URL === 'undefined' || APPS_SCRIPT_URL.includes("https://script.google.com/macros/s/AKfycbzO-F73N55oLF0ZM9zBvoFCdmrlo-92x8lkIvVTAoaApf0mVz_MdY5eLHppzMEf9P0ZdQ/exec")) {
            resultElement.textContent = 'Erro: URL do Apps Script não configurada no arquivo config.js.';
            console.error("A variável APPS_SCRIPT_URL não está configurada.");
            return;
        }

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
                    // Pega o valor da coluna B (índice 1)
                    const numeroPedido = foundRow[1] || 'Não informado';
                    
                    resultElement.innerHTML = `Nº do Pedido: <strong>${numeroPedido}</strong><br>Buscando no Drive...`;
                    
                    // Chama a função para buscar a pasta usando nosso script
                    searchFolderWithAppsScript(numeroPedido);
                } else {
                    // Código não encontrado na planilha
                    resultElement.textContent = `${barcode} não encontrado!`;
                }
            } else {
                resultElement.textContent = 'Planilha vazia ou não encontrada.';
            }
        } catch (error) {
            console.error('Erro na busca:', error);
            resultElement.textContent = 'Falha na comunicação com a planilha.';
        }
    }

    async function searchFolderWithAppsScript(folderName) {
        const url = `${APPS_SCRIPT_URL}?folderName=${encodeURIComponent(folderName)}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.success && data.url) {
                // Pasta encontrada pelo script!
                resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br><a href="${data.url}" target="_blank">Pasta encontrada!</a>`;
                
                // Mostra o container para tirar fotos
                photoCaptureContainer.style.display = 'flex';
                startPhotoBtn.style.display = 'block';
                capturePhotoBtn.style.display = 'none';

                // Configura o evento para o botão "Tirar Fotos"
                // Usamos .onclick para sobrescrever eventos anteriores e evitar múltiplos listeners
                startPhotoBtn.onclick = () => {
                    startPhotoCamera(data.folderId, folderName);
                };

            } else {
                // Pasta não encontrada ou erro no script
                let message = data.message || "Pasta não encontrada no Drive.";
                if (data.error) {
                    console.error("Erro no Apps Script:", data.error);
                }
                resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>${message}`;
                photoCaptureContainer.style.display = 'none'; // Esconde se não achou a pasta
            }

        } catch (error) {
            console.error('Erro ao chamar o Apps Script:', error);
            resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Falha ao buscar no Drive.`;
            photoCaptureContainer.style.display = 'none';
        }
    }

    async function startPhotoCamera(folderId, folderName) {
        startPhotoBtn.style.display = 'none';
        resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Prepare-se para a foto 1...`;
        cameraView.style.display = 'block';

        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraView.srcObject = stream;
            await cameraView.play();

            capturePhotoBtn.style.display = 'block';
            let photoCount = 0;

            capturePhotoBtn.onclick = async () => {
                if (photoCount >= 2) return;

                // 1. Captura a imagem
                photoCanvas.width = cameraView.videoWidth;
                photoCanvas.height = cameraView.videoHeight;
                const context = photoCanvas.getContext('2d');
                context.drawImage(cameraView, 0, 0, photoCanvas.width, photoCanvas.height);

                // 2. Converte para Base64
                const imageData = photoCanvas.toDataURL('image/jpeg');

                photoCount++;
                capturePhotoBtn.disabled = true;
                capturePhotoBtn.textContent = `Enviando foto ${photoCount}...`;

                // 3. Envia para o Apps Script
                await uploadPhotoToDrive(imageData, folderId, folderName, photoCount);

                capturePhotoBtn.disabled = false;

                if (photoCount < 2) {
                    capturePhotoBtn.textContent = 'Capturar Foto';
                    resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Prepare-se para a foto ${photoCount + 1}...`;
                } else {
                    // Finalizou
                    stream.getTracks().forEach(track => track.stop());
                    cameraView.style.display = 'none';
                    capturePhotoBtn.style.display = 'none';
                    startPhotoBtn.style.display = 'block'; // Permite tirar fotos novamente se quiser
                    resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Fotos enviadas com sucesso!`;
                }
            };

        } catch (error) {
            console.error('Erro ao iniciar câmera para fotos:', error);
            alert('Não foi possível acessar a câmera para tirar fotos.');
        }
    }

    async function uploadPhotoToDrive(imageData, folderId, folderName, photoNumber) {
        const payload = {
            folderId: folderId,
            imageData: imageData.split(',')[1], // Remove o "data:image/jpeg;base64,"
            fileName: `${folderName}-foto-${photoNumber}.jpg`
        };

        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        // Não estamos tratando o retorno aqui por simplicidade, mas poderia ser feito.
    }
});

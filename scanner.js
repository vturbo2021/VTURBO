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
    // Novos elementos da UI
    const photoProgressIndicator = document.getElementById('photo-progress-indicator');
    const photoThumbnailsContainer = document.getElementById('photo-thumbnails-container');
    const thumbnail1 = document.getElementById('thumbnail-1');
    const thumbnail2 = document.getElementById('thumbnail-2');
    const saveLocalBtn = document.getElementById('save-local-btn');

    let barcodeDetector;
    let zxingCodeReader;
    let useZxing = false;

    // 1. Verifica se o navegador suporta a API BarcodeDetector
    if (!('BarcodeDetector' in window)) {
        console.log('BarcodeDetector não suportado. Usando ZXing como fallback.');
        useZxing = true;
    } else {
        barcodeDetector = new BarcodeDetector({
            formats: ['code_128', 'ean_13', 'qr_code'] // Adicione outros formatos se necessário
        });
    }

    startScanBtn.addEventListener('click', async () => {        
        // Garante que a seção de fotos esteja escondida ao iniciar um novo scan
        photoCaptureContainer.style.display = 'none';

        // Esconde o input para dar espaço para a câmera
        document.getElementById('input-container').style.display = 'none';
        resultElement.textContent = 'Aponte para o código...';

        cameraView.style.display = 'block'; // Mostra o vídeo

        // Esconde o botão de scan para evitar cliques múltiplos e dar espaço
        document.getElementById('camera-button-container').style.display = 'none';

        try {
            // 2. Pede permissão e inicia a câmera
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' } // Prefere a câmera traseira
            });
            cameraView.srcObject = stream;
            await cameraView.play();

            // 3. Inicia a detecção de códigos de barras
            if (useZxing) {
                // Inicia a detecção com a biblioteca ZXing
                detectBarcodeWithZxing();
            } else {
                detectBarcode();
            }

        } catch (error) {
            console.error('Erro ao acessar a câmera:', error);
            alert('Não foi possível acessar a câmera. Verifique as permissões.');
            cameraView.style.display = 'none';
            document.getElementById('camera-button-container').style.display = 'block'; // Mostra o botão novamente em caso de erro
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

    function handleBarcodeFound(barcodeValue) {
        console.log('Código de barras detectado:', barcodeValue);

        // Para a câmera e o scanner
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (zxingCodeReader) {
            zxingCodeReader.reset(); // Para a detecção do ZXing
        }
        cameraView.style.display = 'none';
        
        // Mostra a UI principal novamente
        document.getElementById('input-container').style.display = 'flex';
        document.getElementById('camera-button-container').style.display = 'block';

        // Pesquisa o código na planilha
        searchBarcodeInSheet(barcodeValue);
    }

    async function detectBarcode() {
        if (!barcodeDetector || cameraView.style.display === 'none') return;

        try {
            const barcodes = await barcodeDetector.detect(cameraView);

            if (barcodes.length > 0) {
                handleBarcodeFound(barcodes[0].rawValue);
            } else {
                // Se nenhum código for encontrado, tenta novamente no próximo frame
                requestAnimationFrame(detectBarcode);
            }
        } catch (error) {
            console.error('Erro na detecção do código de barras:', error);
        }
    }

    function detectBarcodeWithZxing() {
        // Garante que a biblioteca ZXing foi carregada
        if (typeof ZXingBrowser === 'undefined') {
            alert('Erro ao carregar a biblioteca de scanner. Tente recarregar a página.');
            return;
        }

        zxingCodeReader = new ZXingBrowser.BrowserMultiFormatReader();
        zxingCodeReader.decodeFromVideoDevice(undefined, cameraView, (result, err) => {
            if (result) {
                // Código de barras encontrado!
                handleBarcodeFound(result.getText());
            }
            if (err && !(err instanceof ZXingBrowser.NotFoundException)) {
                console.error('Erro na detecção com ZXing:', err);
            }
        }).catch(err => {
            console.error('Erro ao iniciar o decoder do ZXing:', err);
            alert('Não foi possível iniciar o scanner alternativo.');
        });
    }

    async function searchBarcodeInSheet(barcode) {
        resultElement.textContent = 'Verificando na planilha...';

        // Adiciona uma verificação para garantir que as variáveis de config existem
        if (typeof GOOGLE_API_KEY === 'undefined' || typeof SPREADSHEET_ID === 'undefined') {
            resultElement.textContent = 'Erro: Arquivo de configuração não encontrado.';
            return;
        }

        // Constrói a URL para a API do Google Sheets
        const range = `${SHEET_NAME}!A:C`; // Pesquisa na coluna A e retorna dados das colunas A, B e C
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`;
 
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Erro ${response.status}: ${errorData.error.message}`);
            }

            const data = await response.json();
            const rows = data.values;

            if (rows) {
                const foundRow = rows.find(row => row[0] === barcode); // Procura o código na primeira coluna (índice 0)

                if (foundRow) {
                    // Código encontrado! Exibe os dados.
                    // Pega o valor da coluna B (índice 1)
                    const folderName = foundRow[1] || 'Não informado';
                    
                    resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Pronto para fotos.`;
                
                    // Mostra o container para tirar fotos
                    photoCaptureContainer.style.display = 'flex';
                    // Prepara os botões para o próximo passo
                    startPhotoBtn.style.display = 'block'; // Botão para iniciar a câmera
                    capturePhotoBtn.style.display = 'none'; // Botão de captura fica escondido

                    // Configura o evento para o botão "Tirar Fotos"
                    startPhotoBtn.onclick = () => startPhotoCamera(folderName);
                } else {
                    // Código não encontrado na planilha
                    resultElement.textContent = `${barcode} não encontrado!`;
                }
            } else {
                resultElement.textContent = 'Planilha vazia ou não encontrada.';
            }
        } catch (error) {
            console.error('Erro na busca:', error);
            resultElement.textContent = `Falha na busca: ${error.message}`;
        }
    }

    async function startPhotoCamera(folderName) {
        // Elementos que serão escondidos temporariamente
        const inputContainer = document.getElementById('input-container');
        const resultContainer = document.getElementById('result-container');

        // Array para armazenar as fotos em cache
        const photoCache = [];
        const TOTAL_PHOTOS = 6;

        // Reseta e mostra os indicadores de progresso
        for (let i = 1; i <= TOTAL_PHOTOS; i++) {
            document.getElementById(`photo${i}-status`).textContent = `Foto ${i}: ⚪`;
            document.getElementById(`thumbnail-${i}`).src = "";
        }
        photoThumbnailsContainer.style.display = 'none';
        photoProgressIndicator.style.display = 'block';

        startPhotoBtn.style.display = 'none'; // Esconde o botão de iniciar
        resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Prepare-se para a foto 1...`;
        cameraView.style.display = 'block';   // Mostra a visualização da câmera
        capturePhotoBtn.style.display = 'block'; // Mostra o botão de captura imediatamente

        // Esconde os elementos para dar espaço para a câmera
        inputContainer.style.display = 'none';
        resultContainer.style.display = 'none';

        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            cameraView.srcObject = stream;
            await cameraView.play();

            // Define a função para capturar a foto
            const handleCapture = async () => {
                // 1. Captura a imagem
                photoCanvas.width = cameraView.videoWidth;
                photoCanvas.height = cameraView.videoHeight;
                const context = photoCanvas.getContext('2d');
                context.drawImage(cameraView, 0, 0, photoCanvas.width, photoCanvas.height);
                const imageData = photoCanvas.toDataURL('image/jpeg');
                photoCache.push(imageData);

                // 2. Atualiza a UI
                const photoNumber = photoCache.length;
                document.getElementById(`photo${photoNumber}-status`).textContent = `Foto ${photoNumber}: ✅`;
                document.getElementById(`thumbnail-${photoNumber}`).src = imageData;
                
                if (photoNumber === 1) {
                    photoThumbnailsContainer.style.display = 'flex';
                }

                if (photoNumber < TOTAL_PHOTOS) {
                    resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Prepare-se para a foto ${photoNumber + 1}...`;
                } else {
                    resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Captura finalizada!`;

                    // Para a câmera e finaliza o processo
                    stream.getTracks().forEach(track => track.stop());
                    cameraView.style.display = 'none';
                    capturePhotoBtn.style.display = 'none'; // Esconde o botão de captura
                    saveLocalBtn.style.display = 'block'; // Mostra o botão de salvar

                    // Reexibe os containers principais, pronto para um novo scan
                    inputContainer.style.display = 'flex';
                    resultContainer.style.display = 'block';

                    // Adiciona o evento para o botão de salvar
                    saveLocalBtn.onclick = async () => {
                        if (!window.showDirectoryPicker) {
                            alert("Seu navegador não suporta salvar em uma pasta específica. As fotos serão baixadas individualmente.");
                            // Fallback para navegadores sem suporte
                            photoCache.forEach((imgData, index) => {
                                const link = document.createElement('a');
                                link.href = imgData;
                                link.download = `${folderName}-foto-${index + 1}.jpg`;
                                link.click();
                            });
                        } else {
                            // Lógica para salvar na pasta escolhida pelo usuário
                            await savePhotosToDirectory(photoCache, folderName);
                        }
                        saveLocalBtn.style.display = 'none'; // Esconde o botão após o uso
                    };

                    // Remove o listener para não acumular
                    capturePhotoBtn.removeEventListener('click', handleCapture);
                }
            };

            // Adiciona o listener inicial para capturar as fotos
            capturePhotoBtn.addEventListener('click', handleCapture);

        } catch (error) {
            console.error('Erro ao iniciar câmera para fotos:', error);
            alert('Não foi possível acessar a câmera para tirar fotos.');
            // Garante que a UI volte ao normal em caso de erro na câmera
            inputContainer.style.display = 'flex';
            resultContainer.style.display = 'block';
        }
    }

    async function savePhotosToDirectory(photos, folderName) {
        try {
            // 1. Pede ao usuário para escolher uma pasta
            const dirHandle = await window.showDirectoryPicker();

            resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Salvando fotos...`;

            // 2. Itera sobre as fotos em cache e as salva
            for (let i = 0; i < photos.length; i++) {
                const imgData = photos[i];
                const fileName = `${folderName}-foto-${i + 1}.jpg`;

                // Converte a imagem Base64 para um Blob
                const response = await fetch(imgData);
                const blob = await response.blob();

                // Cria o arquivo na pasta escolhida
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
            }

            resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br>Fotos salvas com sucesso na pasta escolhida!`;
        } catch (error) {
            // O erro mais comum é o usuário cancelar a seleção da pasta.
            console.error('Erro ao salvar fotos localmente:', error);
            if (error.name !== 'AbortError') {
                resultElement.innerHTML = `Nº do Pedido: <strong>${folderName}</strong><br><span style="color: red;">Falha ao salvar as fotos.</span>`;
            }
        }
    }
});

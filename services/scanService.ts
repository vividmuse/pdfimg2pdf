import type { ScanMode, ScanServiceConfig, ScanOrderRequest, ScanOrderResponse, ScanOrderDataIn, OSSUploadParams, OSSParamsResponse } from '../types';

// 扫描服务配置
const SCAN_CONFIG: ScanServiceConfig = {
    apiBaseUrl: '/scan-proxy',
    itemId: '3102',
    itemName: '证件扫描',
    defaultPrice: 5.9,
    pollInterval: 2000,
    maxPollAttempts: 30,
};

/**
 * 生成唯一订单ID（15位）
 */
function generateOrderId(): string {
    // 使用15位时间戳（毫秒 + 2位随机数）
    const timestamp = Date.now(); // 13位
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0'); // 2位
    return `${timestamp}${random}`; // 15位
}

/**
 * 生成用户ID
 */
function generateUserId(): string {
    // 使用localStorage缓存用户ID，保持会话一致性
    const storageKey = 'scan_user_id';
    let userId = localStorage.getItem(storageKey);

    if (!userId) {
        userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(storageKey, userId);
    }

    return userId;
}

/**
 * 获取OSS上传参数
 */
async function getOSSParams(filename: string): Promise<any> {
    try {
        const paramsEndpoint = import.meta.env.DEV
            ? '/api/oss/params'
            : 'https://www.xiexinbao.com/oss_hz/params';
        const url = `${paramsEndpoint}?mime=application/octet-stream&filename=${encodeURIComponent(filename)}`;

        const response = await fetch(url, {
            method: 'GET',
            mode: 'cors',
        });

        if (!response.ok) {
            throw new Error('获取上传参数失败，请重试');
        }

        const result = await response.json();

        // 直接返回结果，API返回格式为: {date, authorization, filename, mime, host, ...}
        return result;
    } catch (error) {
        console.error('获取OSS参数失败:', error);
        throw new Error(error instanceof Error ? error.message : '获取上传参数失败，请重试');
    }
}

/**
 * 上传到OSS（浏览器端直接上传）
 */
async function uploadToOSS(blob: Blob, params: any, id: string): Promise<string> {
    try {
        const ossHost = params.host || params.host_cdn;
        const filename = params.filename?.startsWith('/') ? params.filename : `/${params.filename}`;
        if (!ossHost || !params.authorization || !params.date || !params.filename) {
            throw new Error('OSS上传参数不完整，请重试');
        }
        const uploadUrl = `https://${ossHost}${filename}`;

        console.log('Uploading to OSS:', uploadUrl);
        console.log('Using authorization:', params.authorization);
        console.log('Using date:', params.date);

        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': params.authorization,
                'Content-Type': params.mime || 'application/octet-stream',
                'x-oss-date': params.date,
                'Content-Disposition': `attachment; filename=${id}.jpg`,
                ...(params.security_token ? { 'x-oss-security-token': params.security_token } : {}),
            },
            body: blob,
            mode: 'cors',
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OSS upload failed:', response.status, errorText);
            throw new Error('上传到OSS失败，请重试');
        }

        console.log('OSS upload successful');
        return uploadUrl;
    } catch (error) {
        console.error('上传到OSS失败:', error);
        throw new Error(error instanceof Error ? error.message : '上传失败，请重试');
    }
}

/**
 * 上传图片文件（通过服务器端代理）
 */
export async function uploadImage(imageBlob: Blob, filename: string = 'scan.jpg'): Promise<string> {
    try {
        // 生成15位ID（与原始API一致）
        const id = generateOrderId(); // 15位
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const ossFilename = `/yhl/ori_file/${date}/${id}/${id}.jpg`;

        console.log('Generated filename:', ossFilename);

        // 直接使用签名参数上传到OSS（避免生产环境缺少代理导致失败）
        const params = await getOSSParams(ossFilename);
        const url = await uploadToOSS(imageBlob, params, id);

        console.log('Upload successful:', url);
        return url;
    } catch (error) {
        console.error('图片上传失败:', error);
        throw new Error(error instanceof Error ? error.message : '图片上传失败，请重试');
    }
}

/**
 * 创建扫描订单
 */
export async function createScanOrder(
    imageUrls: string[],
    scanMode: ScanMode = 'merge',
    watermark: string = ''
): Promise<string> {
    try {
        const orderId = generateOrderId();
        const userId = generateUserId();

        // 构建data_in对象
        const dataIn: ScanOrderDataIn = {
            ori_file_name: imageUrls.length === 2 ? '正面+反面.jpg' : '文档.jpg',
            ori_file_size: (imageUrls.length * 0.5).toFixed(2),
            task_type: 'docscan',
            ori_file_url: imageUrls,
            task_params: {
                task_type: 'docscan',
                preview_num: scanMode === 'separate' ? 2 : 1,
                scan_mode: scanMode,
                watermark: watermark,
            },
            member_cost: 1,
            page_num: imageUrls.length,
            result_loading: 6,
        };

        // 构建result_msg
        const resultMsg = {
            watermark: watermark || '仅供预览 保存后无此水印',
            notice_text: null,
        };

        // 构建URL编码参数
        const params = new URLSearchParams({
            id: orderId,
            item_id: '3101',  // 文档扫描
            item_name: '文档扫描',
            user_id: userId,
            price: '5.9',
            data_in: JSON.stringify(dataIn),
            pay_callback: `https://your-domain.com/result?id=${orderId}`,
            pay_tc: 'single',
            data_out: '',
            data_out_temp: imageUrls[0] || '',
            result_msg: JSON.stringify(resultMsg),
        });

        // 调用订单创建接口
        const orderEndpoint = import.meta.env.DEV
            ? '/api/order/add'
            : 'https://p.xiexinbao.com/yhl_order/add';

        const response = await fetch(orderEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: params.toString(),
            mode: 'cors',
        });

        if (!response.ok) {
            throw new Error('无法创建扫描订单，请稍后重试');
        }

        const result = await response.json();

        console.log('Order creation response:', result);

        // 检查响应格式：{"status":1,"msg":"添加成功"}
        if (result.status !== 1) {
            throw new Error(result.msg || '订单创建失败，请重试');
        }

        console.log('Order created successfully:', orderId);
        return orderId;  // 直接返回我们生成的orderId
    } catch (error) {
        console.error('创建订单失败:', error);
        throw new Error(error instanceof Error ? error.message : '订单创建失败，请重试');
    }
}

/**
 * 轮询订单状态
 */
export async function pollOrderStatus(
    orderId: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    let attempts = 0;

    return new Promise((resolve, reject) => {
        const poll = async () => {
            try {
                attempts++;

                if (attempts > SCAN_CONFIG.maxPollAttempts) {
                    reject(new Error('扫描处理超时，请检查网络后重试'));
                    return;
                }

                // 更新进度
                const progress = Math.min(95, (attempts / SCAN_CONFIG.maxPollAttempts) * 100);
                onProgress?.(progress);

                // 查询订单状态
                const statusEndpoint = import.meta.env.DEV
                    ? `/api/order-status/item?id=${orderId}`
                    : `https://www.xiexinbao.com/yhl_order/item?id=${orderId}`;

                const response = await fetch(statusEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    },
                    mode: 'cors',
                });

                if (!response.ok) {
                    throw new Error('无法查询订单状态');
                }

                const result = await response.json();

                console.log('Order status:', {
                    status: result.status,
                    dataOut: result.data_out,
                    attempts
                });

                // 检查订单完成状态
                // status: 1 表示订单已完成
                // data_out: 包含PDF下载链接（JSON字符串）
                if (result.status === 1 && result.data_out) {
                    try {
                        // data_out是JSON字符串，需要解析
                        const dataOut = typeof result.data_out === 'string'
                            ? JSON.parse(result.data_out)
                            : result.data_out;

                        // 提取OSS文件下载URL
                        const pdfUrl = dataOut.oss_file_download_url;

                        if (pdfUrl) {
                            onProgress?.(100);
                            console.log('PDF ready:', pdfUrl);
                            resolve(pdfUrl);
                        } else {
                            // PDF还在生成中
                            console.log('PDF URL not available yet, continue polling...');
                            setTimeout(poll, SCAN_CONFIG.pollInterval);
                        }
                    } catch (error) {
                        console.error('Failed to parse data_out:', error);
                        reject(new Error('获取PDF链接失败'));
                    }
                } else if (result.status === -1 || result.status === 2) {
                    // status: -1 或 2 可能表示失败
                    reject(new Error('扫描处理失败，请检查图片质量后重试'));
                } else {
                    // 继续轮询
                    setTimeout(poll, SCAN_CONFIG.pollInterval);
                }
            } catch (error) {
                console.error('状态查询错误:', error);
                // 继续重试，但不抛出错误
                if (attempts < SCAN_CONFIG.maxPollAttempts) {
                    setTimeout(poll, SCAN_CONFIG.pollInterval);
                } else {
                    reject(new Error('无法获取扫描状态，请重试'));
                }
            }
        };

        // 开始轮询
        poll();
    });
}

/**
 * 下载结果PDF
 */
export async function downloadResult(resultUrl: string, filename: string = 'scan_result.pdf'): Promise<void> {
    try {
        const response = await fetch(resultUrl, {
            mode: 'cors',
        });

        if (!response.ok) {
            throw new Error('PDF下载失败，请重试');
        }

        const blob = await response.blob();

        // 创建下载链接
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error('下载失败:', error);
        throw new Error(error instanceof Error ? error.message : 'PDF下载失败，请重试');
    }
}

/**
 * 完整的扫描流程
 * 上传图片 -> 创建订单 -> 轮询状态 -> 返回PDF URL
 */
export async function performScan(
    imageBlobs: Blob[],
    scanMode: ScanMode = 'merge',
    watermark: string = '',
    onProgress?: (stage: string, progress: number) => void
): Promise<string> {  // 返回PDF URL而不是void
    try {
        // 阶段1: 上传图片
        onProgress?.('uploading', 0);
        const imageUrls: string[] = [];

        for (let i = 0; i < imageBlobs.length; i++) {
            const url = await uploadImage(imageBlobs[i], `image_${i + 1}.jpg`);
            imageUrls.push(url);
            onProgress?.('uploading', ((i + 1) / imageBlobs.length) * 100);
        }

        // 阶段2: 创建订单
        onProgress?.('creating', 0);
        const orderId = await createScanOrder(imageUrls, scanMode, watermark);
        onProgress?.('creating', 100);

        // 阶段3: 等待处理
        onProgress?.('processing', 0);
        const resultUrl = await pollOrderStatus(orderId, (progress) => {
            onProgress?.('processing', progress);
        });

        // 阶段4: 完成，返回PDF URL（不自动下载）
        onProgress?.('completed', 100);
        console.log('Scan completed, PDF URL:', resultUrl);

        return resultUrl;  // 返回PDF URL供调用方使用
    } catch (error) {
        console.error('扫描流程失败:', error);
        throw error;
    }
}

import { useState } from 'react';
import type { ItemType, ScanServiceState } from '../../types';
import { performScan } from '../../services/scanService';

type ProgressStage = 'idle' | 'uploading' | 'creating' | 'processing' | 'downloading' | 'completed' | 'error';

interface UseScanServiceReturn {
    state: ScanServiceState;
    itemType: ItemType;
    stage: ProgressStage;
    stageMessage: string;
    setItemType: (type: ItemType) => void;
    startScan: (imageBlobs: Blob[]) => Promise<string>;  // 返回PDF URL
    reset: () => void;
}

const STAGE_MESSAGES: Record<ProgressStage, string> = {
    idle: '准备就绪',
    uploading: '正在上传图片...',
    creating: '正在创建订单...',
    processing: '正在处理扫描...',
    downloading: '正在下载结果...',
    completed: '扫描完成！',
    error: '发生错误',
};

export function useScanService(): UseScanServiceReturn {
    const [state, setState] = useState<ScanServiceState>({
        isUploading: false,
        isProcessing: false,
        progress: 0,
        error: null,
    });

    const [itemType, setItemType] = useState<ItemType>('document');  // 默认文档扫描
    const [stage, setStage] = useState<ProgressStage>('idle');

    const startScan = async (imageBlobs: Blob[]): Promise<string> => {  // 返回PDF URL
        try {
            // 重置状态
            setState({
                isUploading: false,
                isProcessing: false,
                progress: 0,
                error: null,
            });
            setStage('idle');

            // 执行扫描流程，返回PDF URL
            const pdfUrl = await performScan(
                imageBlobs,
                itemType,  // 使用itemType
                (currentStage: string, progress: number) => {
                    setStage(currentStage as ProgressStage);
                    setState(prev => ({
                        ...prev,
                        progress,
                        isUploading: currentStage === 'uploading',
                        isProcessing: ['creating', 'processing'].includes(currentStage),
                    }));
                }
            );

            // 完成 - PDF URL已获取
            console.log('Scan service completed, PDF URL:', pdfUrl);
            setStage('completed');
            setState(prev => ({
                ...prev,
                progress: 100,
                isUploading: false,
                isProcessing: false,
            }));

            return pdfUrl;  // 返回PDF URL给调用方
        } catch (error) {
            console.error('扫描失败:', error);
            setStage('error');
            setState(prev => ({
                ...prev,
                error: error instanceof Error ? error.message : '未知错误',
                isUploading: false,
                isProcessing: false,
            }));
            throw error;
        }
    };

    const reset = () => {
        setState({
            isUploading: false,
            isProcessing: false,
            progress: 0,
            error: null,
        });
        setStage('idle');
    };

    return {
        state,
        itemType,
        stage,
        stageMessage: STAGE_MESSAGES[stage],
        setItemType,
        startScan,
        reset,
    };
}

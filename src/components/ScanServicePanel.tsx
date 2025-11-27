import React, { useState } from 'react';
import type { ItemType, PdfPageImage, LayoutMode, ProcessingConfig, PageOrientation } from '../../types';
import { useScanService } from '../hooks/useScanService';
import { useTranslation } from '../i18n/LanguageContext';
import { stitchImagesAndStamp, generateGroupedImages, rotateImageURL } from '../../services/pdfService';

interface ScanServicePanelProps {
    previewImages: Blob[];
    originalFiles: File[];  // 原始文件
    pdfPages: PdfPageImage[];  // 原始页面数据
    layoutMode: LayoutMode;  // 布局模式
    pagesPerGroup: number;  // 分组
    processingConfig: ProcessingConfig;  // 处理配置
    orientation: PageOrientation;  // 方向
    onScanComplete?: (pdfUrl: string) => void;
}

export const ScanServicePanel: React.FC<ScanServicePanelProps> = ({
    previewImages,
    originalFiles,
    pdfPages,
    layoutMode,
    pagesPerGroup,
    processingConfig,
    orientation,
    onScanComplete,
}) => {
    const { t } = useTranslation();
    const {
        state,
        itemType,
        stage,
        stageMessage,
        setItemType,
        startScan,
        reset,
    } = useScanService();

    const [showConfig, setShowConfig] = useState(false);

    const handleStartScan = async () => {
        // 判断是否为单张原始图片
        const isSingleImage = originalFiles.length === 1 && originalFiles[0].type.startsWith('image/');

        if (isSingleImage) {
            // 情况1️⃣：单张图片 - 直接使用原始文件
            console.log('🖼️ 单图原图上传:', originalFiles[0].name, (originalFiles[0].size / 1024).toFixed(2), 'KB');
            const blob = await originalFiles[0].arrayBuffer().then(ab => new Blob([ab], { type: originalFiles[0].type }));

            if (blob.size === 0) {
                alert(t('scan.pleaseProcessImages'));
                return;
            }

            try {
                const pdfUrl = await startScan([blob]);
                console.log('Scan completed, loading PDF:', pdfUrl);
                onScanComplete?.(pdfUrl);
            } catch (error) {
                // 错误已在Hook中处理
            }
        } else {
            // 情况2️⃣：PDF多页 - 按分组拼接并上传
            if (pdfPages.length === 0) {
                alert(t('scan.pleaseProcessImages'));
                return;
            }

            try {
                // 计算分组数
                const groupCount = Math.ceil(pdfPages.length / pagesPerGroup);

                console.log('📚 扫描处理:', groupCount, '组，每组', pagesPerGroup, '页');

                // 生成所有分组图片
                const groupedImageUrls = await generateGroupedImages(
                    pdfPages,
                    layoutMode,
                    pagesPerGroup,
                    processingConfig,
                    orientation
                );

                console.log('✅ 生成', groupedImageUrls.length, '个分组');

                // 检查是否需要旋转（针对横向A4/A3）
                // 扫描服务生成的PDF默认是竖向的，如果上传横向A4图片，会被缩小放在中间
                // 所以我们需要把横向图片旋转90度变成竖向，这样能充满页面
                const shouldRotate = orientation === 'landscape' && (layoutMode.includes('a4') || layoutMode.includes('a3'));
                if (shouldRotate) {
                    console.log('🔄 检测到横向布局，自动旋转图片以适应扫描服务...');
                }

                // 准备所有要上传的图片Blob
                const blobsToUpload: Blob[] = [];

                // 逐一处理每个分组
                for (let i = 0; i < groupedImageUrls.length; i++) {
                    let uploadUrl = groupedImageUrls[i];

                    // 应用旋转
                    if (shouldRotate) {
                        try {
                            uploadUrl = await rotateImageURL(uploadUrl);
                        } catch (err) {
                            console.error('旋转图片失败，将使用原图:', err);
                        }
                    }

                    // 转为Blob
                    const response = await fetch(uploadUrl);
                    const blob = await response.blob();
                    blobsToUpload.push(blob);
                }

                console.log(`📦 准备上传 ${blobsToUpload.length} 张图片作为一个文档...`);

                // 一次性上传所有图片，生成一个多页PDF
                const pdfUrl = await startScan(blobsToUpload);

                console.log('🎉 扫描完成！PDF已生成:', pdfUrl);
                onScanComplete?.(pdfUrl);

            } catch (error) {
                console.error('分组扫描失败:', error);
                // 错误已在Hook中处理
            }
        }
    };

    const isProcessing = state.isUploading || state.isProcessing;
    const canStartScan = previewImages.length > 0 && !isProcessing;

    return (
        <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginTop: '24px',
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
            }}>
                <h3 style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#1b1b1b',
                }}>
                    📄 {t('scan.title')}
                </h3>
                {!isProcessing && (
                    <button
                        onClick={() => setShowConfig(!showConfig)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#667eea',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                        }}
                    >
                        {showConfig ? t('scan.hideConfig') : t('scan.showConfig')}
                    </button>
                )}
            </div>

            {/* 配置区域 - 选择item_name类型 */}
            {showConfig && !isProcessing && (
                <div style={{
                    marginBottom: '16px',
                    padding: '16px',
                    background: '#f6f7fb',
                    borderRadius: '8px',
                }}>
                    {/* 数据上传警告 */}
                    <div style={{
                        marginBottom: '12px',
                        padding: '10px',
                        background: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '6px',
                        fontSize: '13px',
                        color: '#856404',
                    }}>
                        {t('scan.uploadWarning')}
                    </div>

                    <label style={{
                        display: 'block',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#4f4f4f',
                        marginBottom: '8px',
                    }}>
                        {t('scan.itemType')}
                    </label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: `2px solid ${itemType === 'document' ? '#667eea' : '#e0e0e0'}`,
                            background: itemType === 'document' ? 'rgba(102, 126, 234, 0.05)' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}>
                            <input
                                type="radio"
                                name="itemType"
                                value="document"
                                checked={itemType === 'document'}
                                onChange={(e) => setItemType(e.target.value as ItemType)}
                                style={{ marginRight: '8px' }}
                            />
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('scan.type.document')}</span>
                        </label>
                        <label style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: `2px solid ${itemType === 'remove-handwriting' ? '#667eea' : '#e0e0e0'}`,
                            background: itemType === 'remove-handwriting' ? 'rgba(102, 126, 234, 0.05)' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}>
                            <input
                                type="radio"
                                name="itemType"
                                value="remove-handwriting"
                                checked={itemType === 'remove-handwriting'}
                                onChange={(e) => setItemType(e.target.value as ItemType)}
                                style={{ marginRight: '8px' }}
                            />
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('scan.type.removeHandwriting')}</span>
                        </label>
                        <label style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: `2px solid ${itemType === 'remove-watermark' ? '#667eea' : '#e0e0e0'}`,
                            background: itemType === 'remove-watermark' ? 'rgba(102, 126, 234, 0.05)' : 'white',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}>
                            <input
                                type="radio"
                                name="itemType"
                                value="remove-watermark"
                                checked={itemType === 'remove-watermark'}
                                onChange={(e) => setItemType(e.target.value as ItemType)}
                                style={{ marginRight: '8px' }}
                            />
                            <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('scan.type.removeWatermark')}</span>
                        </label>
                    </div>
                </div>
            )}

            {/* 进度显示 */}
            {isProcessing && (
                <div style={{
                    marginBottom: '16px',
                    padding: '16px',
                    background: '#f6f7fb',
                    borderRadius: '8px',
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px',
                    }}>
                        <span style={{ fontSize: '14px', color: '#4f4f4f' }}>
                            {stageMessage}
                        </span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#667eea' }}>
                            {Math.round(state.progress)}%
                        </span>
                    </div>
                    <div style={{
                        width: '100%',
                        height: '6px',
                        background: '#e0e0e0',
                        borderRadius: '3px',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            width: `${state.progress}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                            transition: 'width 0.3s ease',
                        }} />
                    </div>
                </div>
            )}

            {/* 错误提示 */}
            {state.error && (
                <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#ffebee',
                    borderRadius: '8px',
                    border: '1px solid #ef5350',
                }}>
                    <div style={{
                        fontSize: '14px',
                        color: '#c62828',
                        marginBottom: '8px',
                    }}>
                        ❌ {state.error}
                    </div>
                    <button
                        onClick={reset}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#c62828',
                            fontSize: '13px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                        }}
                    >
                        {t('scan.retry')}
                    </button>
                </div>
            )}

            {/* 成功提示 */}
            {stage === 'completed' && (
                <div style={{
                    marginBottom: '16px',
                    padding: '12px',
                    background: '#e8f5e9',
                    borderRadius: '8px',
                    border: '1px solid #4caf50',
                }}>
                    <div style={{
                        fontSize: '14px',
                        color: '#2e7d32',
                        fontWeight: 500,
                    }}>
                        ✅ {t('scan.complete.message')}
                    </div>
                </div>
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: '12px' }}>
                <button
                    onClick={handleStartScan}
                    disabled={!canStartScan}
                    style={{
                        flex: 1,
                        padding: '14px 24px',
                        background: canStartScan
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : '#ccc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '15px',
                        fontWeight: 600,
                        cursor: canStartScan ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        if (canStartScan) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                        }
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    {isProcessing ? t('scan.processing') : `🚀 ${t('scan.upload')}`}
                </button>

                {(stage === 'completed' || state.error) && (
                    <button
                        onClick={reset}
                        style={{
                            padding: '14px 24px',
                            background: 'transparent',
                            color: '#667eea',
                            border: '2px solid #667eea',
                            borderRadius: '8px',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#667eea';
                            e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#667eea';
                        }}
                    >
                        {t('scan.reset')}
                    </button>
                )}
            </div>

            {/* 提示信息 */}
            {!isProcessing && previewImages.length === 0 && (
                <div style={{
                    marginTop: '12px',
                    fontSize: '13px',
                    color: '#717171',
                    textAlign: 'center',
                }}>
                    💡 {t('scan.uploadHint')}
                </div>
            )}
        </div>
    );
};

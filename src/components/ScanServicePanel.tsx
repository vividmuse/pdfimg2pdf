import React, { useState } from 'react';
import type { ScanMode } from '../../types';
import { useScanService } from '../hooks/useScanService';

interface ScanServicePanelProps {
    previewImages: Blob[];
    onScanComplete?: (pdfUrl: string) => void;  // 添加pdfUrl参数
}

export const ScanServicePanel: React.FC<ScanServicePanelProps> = ({
    previewImages,
    onScanComplete,
}) => {
    const {
        state,
        scanMode,
        watermark,
        stage,
        stageMessage,
        setScanMode,
        setWatermark,
        startScan,
        reset,
    } = useScanService();

    const [showConfig, setShowConfig] = useState(false);

    const handleStartScan = async () => {
        if (previewImages.length === 0) {
            alert('请先处理图片');
            return;
        }

        try {
            const pdfUrl = await startScan(previewImages);  // 接收PDF URL
            console.log('Scan completed, loading PDF:', pdfUrl);
            onScanComplete?.(pdfUrl);  // 传递给父组件
        } catch (error) {
            // 错误已在Hook中处理
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
                    📄 扫描服务
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
                        {showConfig ? '收起配置' : '展开配置'}
                    </button>
                )}
            </div>

            {/* 配置区域 */}
            {showConfig && !isProcessing && (
                <div style={{
                    marginBottom: '16px',
                    padding: '16px',
                    background: '#f6f7fb',
                    borderRadius: '8px',
                }}>
                    {/* 扫描模式选择 */}
                    <div style={{ marginBottom: '12px' }}>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#4f4f4f',
                            marginBottom: '8px',
                        }}>
                            扫描模式
                        </label>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <label style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '8px',
                                border: `2px solid ${scanMode === 'merge' ? '#667eea' : '#e0e0e0'}`,
                                background: scanMode === 'merge' ? 'rgba(102, 126, 234, 0.05)' : 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}>
                                <input
                                    type="radio"
                                    name="scanMode"
                                    value="merge"
                                    checked={scanMode === 'merge'}
                                    onChange={(e) => setScanMode(e.target.value as ScanMode)}
                                    style={{ marginRight: '8px' }}
                                />
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>一页模式</span>
                                <div style={{ fontSize: '12px', color: '#717171', marginTop: '4px' }}>
                                    合并到一张纸
                                </div>
                            </label>
                            <label style={{
                                flex: 1,
                                padding: '12px',
                                borderRadius: '8px',
                                border: `2px solid ${scanMode === 'separate' ? '#667eea' : '#e0e0e0'}`,
                                background: scanMode === 'separate' ? 'rgba(102, 126, 234, 0.05)' : 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                opacity: previewImages.length < 2 ? 0.5 : 1,
                                pointerEvents: previewImages.length < 2 ? 'none' : 'auto',
                            }}>
                                <input
                                    type="radio"
                                    name="scanMode"
                                    value="separate"
                                    checked={scanMode === 'separate'}
                                    onChange={(e) => setScanMode(e.target.value as ScanMode)}
                                    style={{ marginRight: '8px' }}
                                    disabled={previewImages.length < 2}
                                />
                                <span style={{ fontSize: '14px', fontWeight: 500 }}>两页模式</span>
                                <div style={{ fontSize: '12px', color: '#717171', marginTop: '4px' }}>
                                    分别成两张纸
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* 水印输入 */}
                    <div>
                        <label style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#4f4f4f',
                            marginBottom: '8px',
                        }}>
                            水印文字（可选）
                        </label>
                        <input
                            type="text"
                            value={watermark}
                            onChange={(e) => setWatermark(e.target.value)}
                            placeholder="如：仅供XX使用"
                            maxLength={50}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '2px solid #e0e0e0',
                                fontSize: '14px',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={(e) => e.target.style.borderColor = '#667eea'}
                            onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                        />
                        <div style={{
                            fontSize: '12px',
                            color: '#717171',
                            marginTop: '4px',
                        }}>
                            {watermark.length}/50
                        </div>
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
                        重试
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
                        ✅ 扫描完成！PDF已开始下载
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
                    {isProcessing ? '处理中...' : '🚀 发送到扫描服务'}
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
                        重置
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
                    💡 请先上传并处理图片
                </div>
            )}
        </div>
    );
};

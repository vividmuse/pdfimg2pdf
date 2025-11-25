
export enum ProcessingStatus {
  IDLE = 'IDLE',
  PROCESSING_PDF = 'PROCESSING_PDF',
  READY = 'READY',
  ERROR = 'ERROR'
}

export type LayoutMode = 'vertical' | 'grid' | 'grid-a4' | 'grid-a3';
export type PageOrientation = 'portrait' | 'landscape';

export interface ProcessingConfig {
  threshold: number; // 0-100 (0 = off)
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  targetColors?: { r: number; g: number; b: number }[]; // Changed from targetColor to targetColors array
  colorTolerance?: number; // 0-100
  strongBinarize?: boolean;
  documentEnhance?: boolean; // New: Enhanced text clarity & background whitening
}



export interface PdfPageImage {
  blob: string;
  width: number;
  height: number;
  pageIndex: number;
}

// ==================== 扫描服务相关类型 ====================

// OSS上传参数
export interface OSSUploadParams {
  policy: string;
  signature: string;
  accessid: string;
  host: string;
  key: string;
  callback?: string;
}

export interface OSSParamsResponse {
  code: number;
  message: string;
  data: OSSUploadParams;
}

export type ScanMode = 'merge' | 'separate';

export interface ScanServiceConfig {
  apiBaseUrl: string;
  itemId: string;
  itemName: string;
  defaultPrice: number;
  pollInterval: number;
  maxPollAttempts: number;
}

// 订单data_in结构（用于JSON序列化）
export interface ScanOrderDataIn {
  ori_file_name: string;
  ori_file_size: string;
  ori_file_url: string[];
  task_type: 'docscan' | 'idscan';
  task_params: {
    task_type: 'docscan' | 'idscan';
    preview_num?: number;
    scan_mode?: ScanMode;
    watermark?: string;
  };
  member_cost: number;
  page_num: number;
  result_loading: number;
}

// 订单请求（URL编码格式）
export interface ScanOrderRequest {
  id: string;
  item_id: string;
  item_name: string;
  user_id: string;
  price: string;
  data_in: string;  // JSON字符串
  data_out: string;
  data_out_temp: string;
  pay_callback: string;
  pay_tc: string;
  result_msg?: string;  // JSON字符串
}

export interface ScanOrderResponse {
  code?: number;
  message?: string;
  // 实际响应是直接返回订单对象，不是嵌套在data中
  id?: string;
  status: number;  // 1: 完成, 0: 处理中, -1: 失败
  data_out: string;  // PDF下载链接
  data_out_temp?: string;
  item_id?: string;
  item_name?: string;
  price?: number;
  generate_status?: number;
  // 其他字段...
  [key: string]: any;
}

export type ScanOrderStatus = 'pending' | 'processing' | 'completed' | 'failed';
// 扫描服务item类型
export type ItemType = 'document' | 'remove-handwriting' | 'remove-watermark';

// 扫描服务状态
export interface ScanServiceState {
  isUploading: boolean;
  isProcessing: boolean;
  progress: number;
  error: string | null;
}

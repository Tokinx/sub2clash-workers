export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

export function badRequest(message, details) {
  return new AppError(400, message, details);
}

export function unauthorized(message = "未登录或会话已失效") {
  return new AppError(401, message);
}

export function notFound(message = "资源不存在") {
  return new AppError(404, message);
}

export function unprocessable(message, details) {
  return new AppError(422, message, details);
}

export function tooManyRequests(message = "请求过于频繁，请稍后再试") {
  return new AppError(429, message);
}

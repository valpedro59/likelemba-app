// Erreur "attendue" qui porte un code HTTP. Tout le reste est traité comme une erreur 500.
export class AppError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.status = status;
  }
}

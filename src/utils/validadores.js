/**
 * Valida o Título de Eleitor baseado no algoritmo oficial do TSE.
 * Módulo 11 com tratamento especial para UF 01 (SP) e 02 (MG).
 * 
 * @param {string|number} titulo 
 * @returns {boolean} true se for válido matematicamente
 */
export function validarTituloEleitor(titulo) {
  if (!titulo) return false;
  
  // Remove todos os caracteres não numéricos
  const tituloLimpo = String(titulo).replace(/\D/g, '');
  
  // Título de eleitor possui 12 dígitos
  if (tituloLimpo.length !== 12) return false;
  
  // Evita falsos positivos como '000000000000'
  if (/^(\d)\1{11}$/.test(tituloLimpo)) return false;

  // Código do estado (UF) vai de 01 a 28
  const uf = parseInt(tituloLimpo.substring(8, 10), 10);
  if (uf < 1 || uf > 28) return false;

  // Cálculo do 1º Dígito Verificador (D1)
  let soma = 0;
  for (let i = 0; i < 8; i++) {
    soma += parseInt(tituloLimpo.charAt(i), 10) * (i + 2);
  }
  
  let d1 = soma % 11;
  if (d1 === 10) {
    d1 = 0;
  } else if (d1 === 11 || d1 === 0) {
    // Exceção histórica: se a UF for SP (01) ou MG (02), e o resto for 0 ou 11, o dígito é 1.
    if (uf === 1 || uf === 2) {
      d1 = 1;
    } else {
      d1 = 0;
    }
  }

  // Cálculo do 2º Dígito Verificador (D2)
  soma = parseInt(tituloLimpo.charAt(8), 10) * 7 + parseInt(tituloLimpo.charAt(9), 10) * 8 + d1 * 9;
  let d2 = soma % 11;
  
  if (d2 === 10) {
    d2 = 0;
  } else if (d2 === 11 || d2 === 0) {
    if (uf === 1 || uf === 2) {
      d2 = 1;
    } else {
      d2 = 0;
    }
  }

  // Compara os dígitos calculados com os 2 últimos dígitos informados
  return (
    d1 === parseInt(tituloLimpo.charAt(10), 10) &&
    d2 === parseInt(tituloLimpo.charAt(11), 10)
  );
}

from typing import List
from app.models.schemas import PlayerData, PlayerRiskLevel


class RiskEvaluator:
    """Evalúa el nivel de riesgo de un jugador basado en sus estadísticas"""

    # Umbrales de riesgo
    KDA_VERY_HIGH = 5.0        # KDA sospechosamente alto para un jugador nuevo
    KDA_HIGH = 3.5
    HEADSHOT_RATE_SUSPICIOUS = 0.35  # Tasa de headshots inusualmente alta
    ACCURACY_SUSPICIOUS = 40.0       # Precisión inusualmente alta
    PLAYER_AGE_WEEKS = 4             # Cuenta de menos de 4 semanas
    MIN_KILLS_FOR_SUSPICION = 50     # Mínimo de kills para evaluar sospecha

    def evaluate(self, player: PlayerData) -> PlayerData:
        """Evalúa un jugador y establece su nivel de riesgo"""
        reasons = []
        risk = PlayerRiskLevel.LOW

        # 1. Baneos previos (máximo riesgo)
        if player.vac_banned:
            risk = PlayerRiskLevel.HIGH
            reasons.append("VAC Ban detectado")

        if player.game_bans > 0:
            risk = PlayerRiskLevel.HIGH
            reasons.append(f"{player.game_bans} Game Ban(s)")

        # 2. Perfil privado (no se puede evaluar)
        if player.is_private:
            risk = PlayerRiskLevel.PRIVATE
            reasons.append("Perfil privado - datos no disponibles")

        # 3. Evaluación de estadísticas (solo si hay datos)
        stats = player.rust_stats
        if stats and not player.is_private:
            # Cuenta nueva con stats altas = sospechoso
            if stats.kills >= self.MIN_KILLS_FOR_SUSPICION and player.account_age_days is not None:
                if player.account_age_days < self.PLAYER_AGE_WEEKS * 7:
                    if stats.kda >= self.KDA_VERY_HIGH:
                        risk = self._max_risk(risk, PlayerRiskLevel.HIGH)
                        reasons.append("Cuenta nueva con KDA muy alto")
                    elif stats.kda >= self.KDA_HIGH:
                        risk = self._max_risk(risk, PlayerRiskLevel.MEDIUM)
                        reasons.append("Cuenta nueva con KDA alto")

            # KDA sospechosamente alto
            if stats.kda >= self.KDA_VERY_HIGH:
                risk = self._max_risk(risk, PlayerRiskLevel.HIGH)
                reasons.append(f"KDA muy alto ({stats.kda})")

            # Tasa de headshots alta
            if stats.kills > 0:
                hs_rate = stats.headshots / stats.kills
                if hs_rate >= self.HEADSHOT_RATE_SUSPICIOUS:
                    risk = self._max_risk(risk, PlayerRiskLevel.MEDIUM)
                    reasons.append(f"Tasa de headshots alta ({hs_rate:.0%})")

            # Precisión alta
            if stats.accuracy_percent >= self.ACCURACY_SUSPICIOUS:
                risk = self._max_risk(risk, PlayerRiskLevel.MEDIUM)
                reasons.append(f"Precisión alta ({stats.accuracy_percent:.1f}%)")

        # Si no hay razones pero tiene juego, es bajo riesgo
        player.risk_level = risk
        player.risk_reasons = reasons
        return player

    def _max_risk(self, current: PlayerRiskLevel, new: PlayerRiskLevel) -> PlayerRiskLevel:
        """Devuelve el riesgo más alto entre dos niveles"""
        order = {
            PlayerRiskLevel.LOW: 0,
            PlayerRiskLevel.PRIVATE: 1,
            PlayerRiskLevel.MEDIUM: 2,
            PlayerRiskLevel.HIGH: 3,
        }
        return new if order[new] > order[current] else current


risk_evaluator = RiskEvaluator()
declare name "Tremolo";
declare description "Stereo tremolo with rate and depth";

rate = hslider("rate[unit:Hz]", 5, 0.1, 20, 0.01);
depth = hslider("depth", 0.5, 0, 1, 0.01);

lfo = 0.5 * (1 + os.osc(rate));
gain = 1 - depth * lfo;

process = _ * gain, _ * gain;
import("stdfaust.lib");
